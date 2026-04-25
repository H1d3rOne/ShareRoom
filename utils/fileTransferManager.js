// 文件传输管理器 - 支持并行上传、断点续传和分块传输
export class FileTransferManager {
  constructor(options = {}) {
    this.options = {
      chunkSize: options.chunkSize || 256 * 1024, // 256KB块大小
      parallelUploads: options.parallelUploads || 4, // 并行上传数
      maxRetries: options.maxRetries || 3, // 最大重试次数
      retryDelay: options.retryDelay || 1000, // 重试延迟
      onProgress: options.onProgress || (() => {}),
      onComplete: options.onComplete || (() => {}),
      onError: options.onError || (() => {}),
      onChunkComplete: options.onChunkComplete || (() => {}),
      ...options
    }
    
    this.transfers = new Map() // 存储所有传输任务
    this.sendQueue = [] // 发送队列
    this.activeUploads = 0 // 当前活跃的上传数
  }
  
  // 开始文件传输
  startTransfer(file, metadata = {}) {
    const transferId = this.generateTransferId()
    
    const transfer = {
      id: transferId,
      file: file,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        ...metadata
      },
      chunks: this.createChunks(file),
      uploadedChunks: new Set(),
      failedChunks: new Map(),
      status: 'pending',
      startTime: Date.now(),
      progress: 0
    }
    
    this.transfers.set(transferId, transfer)
    
    console.log('开始文件传输:', transfer.metadata.fileName, '大小:', transfer.metadata.fileSize)
    console.log('总块数:', transfer.chunks.length)
    
    // 开始并行上传
    this.processQueue()
    
    return transferId
  }
  
  // 创建文件块
  createChunks(file) {
    const chunks = []
    const totalChunks = Math.ceil(file.size / this.options.chunkSize)
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.options.chunkSize
      const end = Math.min(start + this.options.chunkSize, file.size)
      
      chunks.push({
        index: i,
        start: start,
        end: end,
        size: end - start,
        status: 'pending',
        retries: 0
      })
    }
    
    return chunks
  }
  
  // 处理上传队列
  processQueue() {
    // 找出所有待传输的任务
    const pendingTransfers = Array.from(this.transfers.values())
      .filter(t => t.status === 'pending' || t.status === 'uploading')
    
    for (const transfer of pendingTransfers) {
      // 找出待上传的块
      const pendingChunks = transfer.chunks.filter(chunk => 
        chunk.status === 'pending' && 
        !transfer.uploadedChunks.has(chunk.index)
      )
      
      // 添加到发送队列
      for (const chunk of pendingChunks) {
        if (this.sendQueue.findIndex(c => c.transferId === transfer.id && c.chunkIndex === chunk.index) === -1) {
          this.sendQueue.push({
            transferId: transfer.id,
            chunkIndex: chunk.index,
            chunk: chunk
          })
        }
      }
    }
    
    // 开始并行上传
    while (this.activeUploads < this.options.parallelUploads && this.sendQueue.length > 0) {
      const item = this.sendQueue.shift()
      this.uploadChunk(item.transferId, item.chunkIndex, item.chunk)
    }
  }
  
  // 上传单个块
  async uploadChunk(transferId, chunkIndex, chunk) {
    const transfer = this.transfers.get(transferId)
    if (!transfer) {
      return
    }
    
    this.activeUploads++
    chunk.status = 'uploading'
    transfer.status = 'uploading'
    
    try {
      // 读取文件块数据
      const chunkData = await this.readChunkData(transfer.file, chunk)
      
      // 发送文件块
      const success = await this.sendChunk(transfer, chunkIndex, chunkData)
      
      if (success) {
        // 标记为已完成
        chunk.status = 'completed'
        transfer.uploadedChunks.add(chunkIndex)
        
        // 更新进度
        this.updateProgress(transfer)
        
        // 回调
        this.options.onChunkComplete(transferId, chunkIndex, transfer.progress)
        
        // 检查是否完成
        if (transfer.uploadedChunks.size === transfer.chunks.length) {
          this.completeTransfer(transferId)
        }
      } else {
        throw new Error('发送失败')
      }
    } catch (error) {
      console.error('上传块失败:', transferId, chunkIndex, error)
      
      // 重试逻辑
      chunk.retries++
      
      if (chunk.retries < this.options.maxRetries) {
        console.log('重试上传块:', chunkIndex, '第', chunk.retries, '次')
        chunk.status = 'pending'
        
        // 延迟重试
        setTimeout(() => {
          this.sendQueue.unshift({
            transferId: transferId,
            chunkIndex: chunkIndex,
            chunk: chunk
          })
          this.processQueue()
        }, this.options.retryDelay * chunk.retries)
      } else {
        // 标记为失败
        chunk.status = 'failed'
        transfer.failedChunks.set(chunkIndex, error)
        
        this.options.onError(transferId, chunkIndex, error)
      }
    } finally {
      this.activeUploads--
      
      // 继续处理队列
      this.processQueue()
    }
  }
  
  // 读取文件块数据
  readChunkData(file, chunk) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      const blob = file.slice(chunk.start, chunk.end)
      
      reader.onload = (event) => {
        resolve(new Uint8Array(event.target.result))
      }
      
      reader.onerror = (error) => {
        reject(error)
      }
      
      reader.readAsArrayBuffer(blob)
    })
  }
  
  // 发送文件块（需要被外部重写）
  async sendChunk(transfer, chunkIndex, chunkData) {
    // 这个方法需要被外部实现
    // 返回Promise<boolean>表示是否成功
    console.warn('sendChunk方法需要被重写')
    return false
  }
  
  // 更新传输进度
  updateProgress(transfer) {
    const uploadedSize = transfer.uploadedChunks.size * this.options.chunkSize
    transfer.progress = Math.min(100, (uploadedSize / transfer.file.size) * 100)
    
    this.options.onProgress(transfer.id, transfer.progress, {
      uploadedChunks: transfer.uploadedChunks.size,
      totalChunks: transfer.chunks.length,
      uploadedSize: uploadedSize,
      totalSize: transfer.file.size,
      speed: this.calculateSpeed(transfer),
      remainingTime: this.calculateRemainingTime(transfer)
    })
  }
  
  // 计算传输速度
  calculateSpeed(transfer) {
    const elapsed = (Date.now() - transfer.startTime) / 1000 // 秒
    const uploadedSize = transfer.uploadedChunks.size * this.options.chunkSize
    
    if (elapsed === 0) {
      return 0
    }
    
    return uploadedSize / elapsed // 字节/秒
  }
  
  // 计算剩余时间
  calculateRemainingTime(transfer) {
    const speed = this.calculateSpeed(transfer)
    
    if (speed === 0) {
      return Infinity
    }
    
    const remainingSize = transfer.file.size - (transfer.uploadedChunks.size * this.options.chunkSize)
    return remainingSize / speed // 秒
  }
  
  // 完成传输
  completeTransfer(transferId) {
    const transfer = this.transfers.get(transferId)
    
    if (!transfer) {
      return
    }
    
    transfer.status = 'completed'
    transfer.endTime = Date.now()
    
    const duration = (transfer.endTime - transfer.startTime) / 1000
    const avgSpeed = transfer.file.size / duration
    
    console.log('文件传输完成:', transfer.metadata.fileName)
    console.log('总耗时:', duration.toFixed(2), '秒')
    console.log('平均速度:', (avgSpeed / 1024 / 1024).toFixed(2), 'MB/s')
    
    this.options.onComplete(transferId, {
      duration: duration,
      avgSpeed: avgSpeed,
      metadata: transfer.metadata
    })
  }
  
  // 暂停传输
  pauseTransfer(transferId) {
    const transfer = this.transfers.get(transferId)
    
    if (transfer && transfer.status === 'uploading') {
      transfer.status = 'paused'
      console.log('传输已暂停:', transferId)
    }
  }
  
  // 恢复传输
  resumeTransfer(transferId) {
    const transfer = this.transfers.get(transferId)
    
    if (transfer && transfer.status === 'paused') {
      transfer.status = 'pending'
      this.processQueue()
      console.log('传输已恢复:', transferId)
    }
  }
  
  // 取消传输
  cancelTransfer(transferId) {
    const transfer = this.transfers.get(transferId)
    
    if (transfer) {
      transfer.status = 'cancelled'
      this.transfers.delete(transferId)
      console.log('传输已取消:', transferId)
    }
  }
  
  // 获取传输状态
  getTransferStatus(transferId) {
    const transfer = this.transfers.get(transferId)
    
    if (!transfer) {
      return null
    }
    
    return {
      id: transfer.id,
      status: transfer.status,
      progress: transfer.progress,
      uploadedChunks: transfer.uploadedChunks.size,
      totalChunks: transfer.chunks.length,
      failedChunks: transfer.failedChunks.size,
      metadata: transfer.metadata
    }
  }
  
  // 生成传输ID
  generateTransferId() {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  // 断点续传 - 保存传输状态
  saveTransferState(transferId) {
    const transfer = this.transfers.get(transferId)
    
    if (!transfer) {
      return null
    }
    
    const state = {
      id: transfer.id,
      metadata: transfer.metadata,
      uploadedChunks: Array.from(transfer.uploadedChunks),
      failedChunks: Array.from(transfer.failedChunks.entries()),
      timestamp: Date.now()
    }
    
    // 保存到localStorage
    try {
      localStorage.setItem(`transfer_${transferId}`, JSON.stringify(state))
      console.log('传输状态已保存:', transferId)
    } catch (error) {
      console.error('保存传输状态失败:', error)
    }
    
    return state
  }
  
  // 断点续传 - 恢复传输状态
  restoreTransferState(transferId, file) {
    try {
      const stateStr = localStorage.getItem(`transfer_${transferId}`)
      
      if (!stateStr) {
        return null
      }
      
      const state = JSON.parse(stateStr)
      
      // 创建新的传输任务
      const transferId = this.startTransfer(file, state.metadata)
      const transfer = this.transfers.get(transferId)
      
      // 恢复已上传的块
      transfer.uploadedChunks = new Set(state.uploadedChunks)
      transfer.failedChunks = new Map(state.failedChunks)
      
      // 更新块状态
      for (const chunk of transfer.chunks) {
        if (transfer.uploadedChunks.has(chunk.index)) {
          chunk.status = 'completed'
        } else if (transfer.failedChunks.has(chunk.index)) {
          chunk.status = 'failed'
        }
      }
      
      // 更新进度
      this.updateProgress(transfer)
      
      console.log('传输状态已恢复:', transferId)
      console.log('已上传块数:', transfer.uploadedChunks.size, '/', transfer.chunks.length)
      
      return transferId
    } catch (error) {
      console.error('恢复传输状态失败:', error)
      return null
    }
  }
  
  // 清理传输状态
  clearTransferState(transferId) {
    try {
      localStorage.removeItem(`transfer_${transferId}`)
      console.log('传输状态已清理:', transferId)
    } catch (error) {
      console.error('清理传输状态失败:', error)
    }
  }
}
