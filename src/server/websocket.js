const server = require('./server')
const io = require('socket.io')(server)
const ss = require('socket.io-stream')
const axios = require('axios')
const ytdl = require('ytdl-core')
const ytSearch = require('yt-search')

io.of(`/${process.env.APP_NS}`).on('connection', socket => {

  // validation
  socket.on('selected', (t, videoId) => {
    const validTypes = ['video', 'audio']
    const validId = /^[a-zA-Z0-9-_]{11}$/
    if (!validTypes.includes(t) || !validId.test(videoId)) {
      return socket.emit('error', 'invalid video id')
    }
    socket.emit('selected', t, videoId)
  })

  // return search result
  socket.on('search-submit', async input => {
    try {
      const { videos } = await ytSearch(input)
      const result = videos.map(video => ({ title, description, author, url } = video))
      socket.emit('result', result)
    } catch (error) {
      console.error(error.message)
      socket.emit('error', 'an error occurs')
    }
  })

  // search suggestion
  socket.on('search-suggestion', async input => {
    try {
      const result = await axios.get(`http://suggestqueries.google.com/complete/search?client=youtube&output=toolbar&hl=en&q=${encodeURI(input)}`)
      const data = result.data
      const collection = []
      data.split('[').forEach((e, i) => {
        if (!e.split('"')[1] || i === 1 || e.split('"')[1] === 'k') {
          return
        }
        return collection.push(e.split('"')[1])
      })
      socket.emit('search-suggestion-result', collection.filter(item => item !== 'a'))
    } catch (error) {
      socket.emit('error', error.message)
    }
  })

  // log download complete
  socket.on('download-complete', (t, videoId) => {
    console.log(`${new Date().toLocaleDateString()} | Download complete (${t}): ${videoId}`)
  })

  // pipe to client stream
  ss(socket).on('download', async (stream, data, callback) => {
    try {
      const { videoId, t } = data
      const { videoDetails } = await ytdl.getBasicInfo(videoId)
      const { title, ownerChannelName: owner } = videoDetails
      callback(null, { title, owner})
      if (t === 'audio') {
        ytdl(`http://www.youtube.com/watch?v=${videoId}`, {
          filter: 'audioonly',
          quality: 'highestaudio'
        }).pipe(stream)
        return
      }
      const spawn = require('child_process').spawn
      const ffmpeg = require('ffmpeg-static')
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const fileName = `/${Date.now()}-${videoId}.mp4`
      const dir = os.tmpdir()
      const fileOutput = path.join(dir, fileName)
      const executeffmpeg = spawn(ffmpeg, [
        '-loglevel', '8', '-hide_banner', '-thread_queue_size',
        '4096', '-i', 'pipe:3', '-i', 'pipe:4', '-c:v', 'copy',
        '-c:a', 'copy', '-map', '0:v:0', '-map', '1:a:0',
        fileOutput
      ], {
        windowsHide: true,
        stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe', 'pipe']
      })

      ytdl(`http://www.youtube.com/watch?v=${videoId}`, {
        filter: 'audioonly',
        quality: 'highestaudio'
      }).pipe(executeffmpeg.stdio[4])

      ytdl(`http://www.youtube.com/watch?v=${videoId}`, {
        filter: 'videoonly',
        quality: 'highestvideo'
      }).pipe(executeffmpeg.stdio[3])

      executeffmpeg.stdio[5].on('end', () => {
        const output = fs.createReadStream(fileOutput)
        output.pipe(stream)
        output.on('error', () => {
          fs.rmSync(fileOutput, { recursive: true })
          socket.emit('error', 'an error occurs')
        })
        output.on('end', () => {
          fs.rmSync(fileOutput, { recursive: true })
        })
      })

      executeffmpeg.stdio[5].on('error', () => {
        socket.emit('error', 'an error occurs')
      })

    } catch (error) {
      callback(error.message, {})
    }
  })

})