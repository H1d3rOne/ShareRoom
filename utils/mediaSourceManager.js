// MediaSource管理器 - 支持流式播放、缓冲和快进
export class MediaSourceManager {
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement
    this.mediaSource = null
    this.sourceBuffer = null
    this.queue = []
    this.isPlaying = false
    this.isEnded = false
    this.bufferedRanges = []
    this.options = {
      mimeType: options.mimeType || 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
      autoPlay: options.autoPlay !== false,
      bufferSize: options.bufferSize || 30 * 1024 * 1024, // 30MB缓冲区
      ...options
    }
    
    this.init()
  }
  
  init() {
    // 检查浏览器支持
    if (!window.MediaSource) {
      throw new Error('浏览器不支持MediaSource API')
    }
    
    // 创建MediaSource
    this.mediaSource = new MediaSource()
    this.videoElement.src = URL.createObjectURL(this.mediaSource)
    
    // 监听sourceopen事件
    this.mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource已打开')
      this.createSourceBuffer()
    })
    
    // 监听sourceended事件
    this.mediaSource.addEventListener('sourceended', () => {
      console.log('MediaSource已结束')
      this.isEnded = true
    })
    
    // 监听sourceclose事件
    this.mediaSource.addEventListener('sourceclose', () => {
      console.log('MediaSource已关闭')
    })
    
    // 监听视频元素的seeking事件（快进）
    this.videoElement.addEventListener('seeking', () => {
      this.handleSeek()
    })
    
    // 监听视频元素的timeupdate事件
    this.videoElement.addEventListener('timeupdate', () => {
      this.updateBufferedRanges()
    })
  }
  
  createSourceBuffer() {
    try {
      // 尝试创建SourceBuffer
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.options.mimeType)
      
      // 监听updateend事件
      this.sourceBuffer.addEventListener('updateend', () => {
        this.processQueue()
      })
      
      // 监听error事件
      this.sourceBuffer.addEventListener('error', (error) => {
        console.error('SourceBuffer错误:', error)
      })
      
      console.log('SourceBuffer创建成功')
      
      // 自动播放
      if (this.options.autoPlay) {
        this.videoElement.play().catch(err => {
          console.warn('自动播放失败:', err)
        })
      }
    } catch (error) {
      console.error('创建SourceBuffer失败:', error)
      // 尝试使用其他编解码器
      this.tryAlternativeCodecs()
    }
  }
  
  tryAlternativeCodecs() {
    const codecs = [
      'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4; codecs="avc1.4D401E,mp4a.40.2"',
      'video/mp4; codecs="avc1.64001E,mp4a.40.2"',
      'video/webm; codecs="vp8,vorbis"',
      'video/webm; codecs="vp9,opus"',
      'video/mp4'
    ]
    
    for (const codec of codecs) {
      try {
        if (MediaSource.isTypeSupported(codec)) {
          console.log('尝试使用编解码器:', codec)
          this.sourceBuffer = this.mediaSource.addSourceBuffer(codec)
          this.sourceBuffer.addEventListener('updateend', () => {
            this.processQueue()
          })
          console.log('成功创建SourceBuffer')
          return
        }
      } catch (error) {
        console.warn('编解码器尝试失败:', codec, error)
      }
    }
    
    throw new Error('无法创建SourceBuffer，所有编解码器都不支持')
  }
  
  appendBuffer(data) {
    if (!this.sourceBuffer) {
      console.warn('SourceBuffer未初始化，将数据加入队列')
      this.queue.push(data)
      return
    }
    
    if (this.sourceBuffer.updating) {
      console.log('SourceBuffer正在更新，将数据加入队列')
      this.queue.push(data)
      return
    }
    
    try {
      // 检查缓冲区大小
      if (this.getBufferSize() > this.options.bufferSize) {
        console.warn('缓冲区已满，清理旧数据')
        this.cleanupBuffer()
      }
      
      this.sourceBuffer.appendBuffer(data)
      console.log('追加数据到SourceBuffer，大小:', data.byteLength)
    } catch (error) {
      console.error('追加数据失败:', error)
      this.queue.push(data)
    }
  }
  
  processQueue() {
    if (this.queue.length === 0) {
      return
    }
    
    if (this.sourceBuffer.updating) {
      return
    }
    
    const data = this.queue.shift()
    this.appendBuffer(data)
  }
  
  endOfStream() {
    if (this.mediaSource.readyState === 'open') {
      // 等待队列处理完成
      const checkQueue = () => {
        if (this.queue.length === 0 && !this.sourceBuffer.updating) {
          this.mediaSource.endOfStream()
          console.log('MediaSource流已结束')
        } else {
          setTimeout(checkQueue, 100)
        }
      }
      checkQueue()
    }
  }
  
  handleSeek() {
    const currentTime = this.videoElement.currentTime
    console.log('用户快进到:', currentTime)
    
    // 检查当前时间是否在缓冲范围内
    const isBuffered = this.isTimeBuffered(currentTime)
    
    if (!isBuffered) {
      console.log('当前时间未缓冲，需要请求新数据')
      // 触发需要数据的事件
      this.emit('needData', currentTime)
    }
  }
  
  isTimeBuffered(time) {
    for (const range of this.bufferedRanges) {
      if (time >= range.start && time <= range.end) {
        return true
      }
    }
    return false
  }
  
  updateBufferedRanges() {
    if (!this.sourceBuffer || !this.sourceBuffer.buffered) {
      return
    }
    
    this.bufferedRanges = []
    const buffered = this.sourceBuffer.buffered
    
    for (let i = 0; i < buffered.length; i++) {
      this.bufferedRanges.push({
        start: buffered.start(i),
        end: buffered.end(i)
      })
    }
  }
  
  getBufferSize() {
    if (!this.sourceBuffer || !this.sourceBuffer.buffered) {
      return 0
    }
    
    let totalSize = 0
    const buffered = this.sourceBuffer.buffered
    
    for (let i = 0; i < buffered.length; i++) {
      const duration = buffered.end(i) - buffered.start(i)
      // 估算大小（假设1秒视频约1MB）
      totalSize += duration * 1024 * 1024
    }
    
    return totalSize
  }
  
  cleanupBuffer() {
    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      return
    }
    
    const currentTime = this.videoElement.currentTime
    
    try {
      // 移除当前播放位置之前30秒的数据
      const removeEnd = Math.max(0, currentTime - 30)
      if (removeEnd > 0) {
        this.sourceBuffer.remove(0, removeEnd)
        console.log('清理缓冲区: 0 -', removeEnd)
      }
    } catch (error) {
      console.error('清理缓冲区失败:', error)
    }
  }
  
  emit(event, data) {
    // 触发自定义事件
    const customEvent = new CustomEvent(event, { detail: data })
    this.videoElement.dispatchEvent(customEvent)
  }
  
  destroy() {
    if (this.mediaSource) {
      if (this.mediaSource.readyState === 'open') {
        this.sourceBuffer.abort()
      }
      URL.revokeObjectURL(this.videoElement.src)
    }
    
    this.queue = []
    this.bufferedRanges = []
  }
}
