!function (ns) {
  const socket = io(ns)
  const formSearch = document.querySelector('#form-search')
  const suggestionList = document.querySelector('#search-suggestion-list')
  const resultContainer = document.querySelector('#result-container')
  const pageInitial = document.querySelector('#page-initial')
  const pageLoading = document.querySelector('#page-loading')
  const pageMain = document.querySelector('#page-main')
  const showDownloadButton = document.querySelector('#show-downloads')
  const gotoTopButton = document.querySelector('#goto-top')
  const modalDownload = document.querySelector('#modal-download')
  const downloadList = modalDownload.querySelector('#download-list')

  socket.on('selected', (t, videoId) => {
    const stream = ss.createStream()
    const data = []
    let dataLength = 0

    ss(socket).emit('download', stream, { t, videoId }, (error, info) => {
      if (error) {
        delete stream
        return outputError(error)
      }

      const downloadContainer = document.createElement('div')
      downloadContainer.className = t === 'audio' ? 'flex justify-between items-center text-pink-500 bg-slate-50 p-4' : 'flex justify-between items-center text-slate-500 bg-slate-50 p-4'
      
      const downloadTitle = document.createElement('p')
      downloadTitle.className = 'w-3/4 font-bold truncate overflow-x-hidden'
      downloadTitle.append(document.createTextNode(info.title))

      const downloadSize = document.createElement('p')
      downloadSize.className = 'text-sm w-1/4 text-right'
      downloadSize.append(document.createTextNode('Initializing'))

      downloadContainer.append(downloadTitle, downloadSize)

      notifyDownloading(t, info, downloadContainer)

      stream.on('data', chunk => {
        data.push(chunk)
        dataLength += chunk.length
        downloadSize.innerText = `${(dataLength / (1000 * 1000)).toFixed(2)}MB`
      })

      stream.on('error', error => {
        outputError(error)
      })

      stream.on('end', () => {
        
        const fileData = new Uint8Array(dataLength)
        let i = 0

        for (const buffer of data) {
          for (let j = 0; j < buffer.length; j++) {
            fileData[i] = buffer[j]
            i++
          }
        }
        
        const blob = new Blob([fileData], { type: 'octet/stream' })
        const a = document.createElement('a')
        const url = window.URL.createObjectURL(blob)
        a.href = url
        a.download = info.title + (t === 'audio' ? '.mp3' : '.mp4')
        a.click()
        window.URL.revokeObjectURL(url)

        downloadContainer.remove()
        if (downloadList.childElementCount < 1) {
          showDownloadButton.classList.add('scale-0')
          showDownloadButton.classList.remove('scale-100')
          toggleDownloadModal()
        }
      })
    })
  })
  
  socket.on('result', data => {
    formSearch.dataset.onprogress = '0'
    formSearch.q.value = ''
    formSearch.q.disabled = false
    outputResult(data)
  })

  socket.on('search-suggestion-result', data => {
    outputSuggestions(data)
  })

  socket.on('error', outputError)
  
  formSearch.addEventListener('submit', e => {
    e.preventDefault()
    setTimeout(() => {
      formSearch.q.blur()
    }, 100)
    const input = formSearch.q.value.trim()
    if (formSearch.dataset.onprogress === '1' || input.length < 1) {
      return
    }
    formSearch.dataset.onprogress = '1'
    formSearch.q.disabled = true
    if (input.length < 1) {
      return
    }
    pageMain.classList.add('hidden')
    pageLoading.classList.remove('hidden')
    pageLoading.classList.add('flex')
    pageInitial.remove()
    socket.emit('search-submit', input)
  })

  gotoTopButton.addEventListener('click', scrollToTop)

  
  formSearch.q.addEventListener('keydown', e => {
    const key = e.key
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      return e.preventDefault()
    }
  })
  
  formSearch.q.addEventListener('blur', () => {
    setTimeout(() => {
      suggestionList.classList.add('hidden')
    }, 100)
  })

  formSearch.q.addEventListener('focus', () => {
    const input = formSearch.q.value.trim()
    if (input.length < 1) {
      return
    }
    suggestionList.classList.remove('hidden')
  })
  
  formSearch.q.addEventListener('keyup', e => {
    const key = e.key

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      return
    }

    e.preventDefault()

    if (key !== 'ArrowUp' && key !== 'ArrowDown') {
      const input = formSearch.q.value.trim()
      if (input.length < 1) {
        return outputSuggestions([])
      }
      socket.emit('search-suggestion', input)
      return
    }

    const index = suggestionList.dataset.index
    const suggestionItemsCount = suggestionList.childElementCount

    if (suggestionItemsCount < 1) {
      return
    }

    if (key === 'ArrowUp') {
      if (index > 0) {
        suggestionList.dataset.index--
      } else {
        suggestionList.dataset.index = suggestionItemsCount - 1
      }
    } else {
      if (index < suggestionItemsCount - 1) {
        suggestionList.dataset.index++
      } else {
        suggestionList.dataset.index = 0
      }
    }
    const suggestionItems = suggestionList.children
    for (let i = 0; i < suggestionItemsCount; i++) {
      suggestionItems[i].classList.remove('active')
      if (i === parseInt(suggestionList.dataset.index)) {
        suggestionItems[i].classList.add('active')
        formSearch.q.value = suggestionItems[i].dataset.value
      }
    }

  })
  
  function outputResult(data) {
    resultContainer.innerHTML = ''

    for (const e of data) {
      const { videoId, author, image, title } = e
      const channel = author.name

      const card = document.createElement('div')
      card.className = 'card-result'
      card.dataset.id = videoId
      
      const img = document.createElement('img')
      img.src = image
      img.className = 'w-full rounded-md'

      const channelContainer = document.createElement('p')
      channelContainer.className = 'text-sm text-gray-400 my-4 font-bold border-l-2 border-red-500 pl-4'
      channelContainer.append(document.createTextNode(channel))

      const titleContainer = document.createElement('p')
      titleContainer.className = 'text-slate-500 font-poppins text-sm'
      titleContainer.append(document.createTextNode(title))

      const buttonsContainer = document.createElement('div')
      buttonsContainer.className = 'flex items-center justify-between mt-4 gap-x-4 text-xl md:text-base'

      const viewButton = document.createElement('button')
      viewButton.className = 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 w-1/3'
      viewButton.innerHTML = '<i class="fa-solid fa-eye"></i>'
      viewButton.title = 'View video'

      const mp3Button = document.createElement('button')
      mp3Button.className = 'px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 w-1/3'
      mp3Button.innerHTML = '<i class="fa-solid fa-file-audio"></i>'
      mp3Button.title = 'Download Audio'
      mp3Button.addEventListener('click', () => {
        socket.emit('selected', 'audio', videoId)
      })

      const mp4Button = document.createElement('button')
      mp4Button.className = 'px-4 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 w-1/3'
      mp4Button.innerHTML = '<i class="fa-solid fa-file-video"></i>'
      mp4Button.title = 'Download Video'
      mp4Button.addEventListener('click', () => {
        socket.emit('selected', 'video', videoId)
      })
      
      viewButton.addEventListener('click', () => {
        let iframe = card.querySelector('iframe')

        if (iframe) {
          if (iframe.className.includes('hidden')) {
            iframe.classList.remove('hidden')
            img.classList.add('hidden')
          } else {
            iframe.classList.add('hidden')
            img.classList.remove('hidden')
          }
          return
        }

        iframe = document.createElement('iframe')
        iframe.src = `https://www.youtube.com/embed/${videoId}`
        iframe.className = 'w-full rounded-md hidden'
        img.insertAdjacentElement('afterend', iframe)
        viewButton.click()
      })

      buttonsContainer.append(viewButton, mp3Button, mp4Button)
      card.append(img, channelContainer, titleContainer, buttonsContainer)
      resultContainer.append(card)
    }

    scrollToTop()
    outputSuggestions([])
    pageMain.classList.remove('hidden')
    pageLoading.classList.add('hidden')
  }
   
  function outputSuggestions(data) {
    suggestionList.innerHTML = ''
    suggestionList.dataset.index = -1
    if (data.length < 1) {
      return suggestionList.classList.add('hidden')
    }
    suggestionList.classList.remove('hidden')
    data.forEach((e, i) => {
      const item = document.createElement('div')
      e = e.replace(/\\u[\dA-F]{4}/gi, match =>
        String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
      )
      item.className = 'suggestion-item'
      item.innerText = e
      item.dataset.value = e
      suggestionList.append(item)
      item.addEventListener('mouseenter', () => {
        for (const e of suggestionList.children) {
          e.classList.remove('active')
          if (e === item) {
            e.classList.add('active')
            suggestionList.dataset.index = i
          }
        }
      })
      item.addEventListener('click', () => {
        formSearch.q.value = item.dataset.value
        formSearch['submit-btn'].click()
      })
    })
  }

  function scrollToTop() {
    const top = document.documentElement.scrollTop
    window.scrollBy(0, -50)
    if (top - 1 > 0) {
      setTimeout(() => {
        scrollToTop()
      }, 1)
    }
  }

  function toggleDownloadModal(content, show = false) {
    if (show) {
      modalDownload.classList.remove('hidden')
      modalDownload.classList.add('flex')
    } else {
      modalDownload.classList.add('hidden')
      modalDownload.classList.remove('flex')
    }
    let target = null
    for (const e of Array.from(modalDownload.children)) {
      e.classList.add('hidden')
      if (e.dataset.content === content) {
        e.classList.remove('hidden')
        target = e
      }
    }
    return target
  }

  function notifyDownloading(type, info, element) {
    showDownloadButton.classList.remove('scale-0')
    showDownloadButton.classList.add('scale-100')
    const notificationModal = toggleDownloadModal('notify', true)
    notificationModal.querySelector('#download-notify-type').innerText = `Downloading ${type}`
    notificationModal.querySelector('#download-notify-title').innerText = info.title
    downloadList.append(element)
  }

  window.addEventListener('scroll', () => {
    if (document.documentElement.scrollTop > 10) {
      gotoTopButton.classList.remove('scale-0')
      return gotoTopButton.classList.add('scale-100')
    }
    gotoTopButton.classList.remove('scale-100')
    gotoTopButton.classList.add('scale-0')
  })

  modalDownload.addEventListener('click', e => {
    if (e.target === modalDownload) {
      toggleDownloadModal()
    }
  })

  const closeModalButtons = modalDownload.querySelectorAll('button[data-action=modal-close]')
  for (const button of closeModalButtons) {
    button.addEventListener('click', () => {
      toggleDownloadModal()
    })
  }
  
  showDownloadButton.addEventListener('click', () => {
    toggleDownloadModal('list', true)
  })

  function outputError(message) {
    alert(message)
  }

}(`/${NS}`)