import { useCallback, useState } from 'react'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { parseGpx } from './parsers/gpx'
import { parseFit } from './parsers/fit'
import { parseTcx } from './parsers/tcx'
import type { ParsedActivity } from './parsers/gpx'

interface FileDropZoneProps {
  onActivitiesParsed: (activities: ParsedActivity[]) => void
  className?: string
}

interface ParsedFile {
  file: File
  activity?: ParsedActivity
  error?: string
  status: 'pending' | 'parsing' | 'success' | 'error'
}

export function FileDropZone({ onActivitiesParsed, className = '' }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
      e.target.value = '' // Reset input
    }
  }, [])
  
  const handleFiles = async (files: File[]) => {
    setIsProcessing(true)
    
    // Filter for supported file types
    const supportedFiles: File[] = []
    const zipFiles: File[] = []
    
    for (const file of files) {
      const extension = file.name.toLowerCase().split('.').pop()
      if (['gpx', 'fit', 'tcx'].includes(extension || '')) {
        supportedFiles.push(file)
      } else if (extension === 'zip') {
        zipFiles.push(file)
      }
    }
    
    // Process ZIP files to extract activity files
    for (const zipFile of zipFiles) {
      try {
        const extractedFiles = await extractZipFile(zipFile)
        supportedFiles.push(...extractedFiles)
      } catch (error) {
        console.error('Failed to extract ZIP file:', zipFile.name, error)
        setParsedFiles(prev => [...prev, {
          file: zipFile,
          status: 'error',
          error: `Failed to extract ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`
        }])
      }
    }
    
    if (supportedFiles.length === 0) {
      setIsProcessing(false)
      return
    }
    
    // Initialize parsed files state
    const initialParsedFiles: ParsedFile[] = supportedFiles.map(file => ({
      file,
      status: 'pending'
    }))
    setParsedFiles(initialParsedFiles)
    
    // Parse files sequentially to avoid overwhelming the browser
    const parsedActivities: ParsedActivity[] = []
    const updatedFiles: ParsedFile[] = [...initialParsedFiles]
    
    for (let i = 0; i < supportedFiles.length; i++) {
      const file = supportedFiles[i]
      updatedFiles[i] = { ...updatedFiles[i], status: 'parsing' }
      setParsedFiles([...updatedFiles])
      
      try {
        const activity = await parseFile(file)
        parsedActivities.push(activity)
        updatedFiles[i] = { ...updatedFiles[i], status: 'success', activity }
      } catch (error) {
        console.error('Failed to parse file:', file.name, error)
        updatedFiles[i] = { 
          ...updatedFiles[i], 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      
      setParsedFiles([...updatedFiles])
    }
    
    setIsProcessing(false)
    
    if (parsedActivities.length > 0) {
      onActivitiesParsed(parsedActivities)
    }
  }
  
  const parseFile = async (file: File): Promise<ParsedActivity> => {
    const extension = file.name.toLowerCase().split('.').pop()
    
    switch (extension) {
      case 'gpx':
        const gpxContent = await file.text()
        return parseGpx(gpxContent)
      
      case 'fit':
        const fitBuffer = await file.arrayBuffer()
        return parseFit(fitBuffer)
      
      case 'tcx':
        const tcxContent = await file.text()
        return parseTcx(tcxContent)
      
      default:
        throw new Error(`Unsupported file type: ${extension}`)
    }
  }
  
  const extractZipFile = async (_zipFile: File): Promise<File[]> => {
    // For now, we'll show an error for ZIP files since we need a ZIP library
    // In a real implementation, you'd use jszip or similar
    throw new Error('ZIP file extraction not yet implemented. Please extract manually and upload individual files.')
  }
  
  const clearFiles = () => {
    setParsedFiles([])
  }
  
  const removeFile = (index: number) => {
    setParsedFiles(prev => prev.filter((_, i) => i !== index))
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept=".gpx,.fit,.tcx,.zip"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload className="h-12 w-12 text-gray-400" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Drop activity files here, or click to select
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supports GPX, FIT, TCX, and ZIP files
            </p>
          </div>
          
          <div className="text-xs text-gray-400 dark:text-gray-500">
            <p>Supported sources:</p>
            <p>Garmin Export • Strava Export • Apple Health • Fitbit • Generic files</p>
          </div>
        </div>
      </div>
      
      {/* File Processing Status */}
      {parsedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Processing Files ({parsedFiles.filter(f => f.status === 'success').length}/{parsedFiles.length})
            </h3>
            <button
              onClick={clearFiles}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          </div>
          
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {parsedFiles.map((parsedFile, index) => (
              <div
                key={index}
                className={`
                  flex items-center gap-3 p-3 rounded-md text-sm
                  ${parsedFile.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                    parsedFile.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                    parsedFile.status === 'parsing' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    'bg-gray-50 dark:bg-gray-800'
                  }
                `}
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {parsedFile.file.name}
                  </p>
                  {parsedFile.activity && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {parsedFile.activity.name} • {parsedFile.activity.type} • {formatDistance(parsedFile.activity.totalDistance)}
                    </p>
                  )}
                  {parsedFile.error && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {parsedFile.error}
                    </p>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  {parsedFile.status === 'parsing' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  )}
                  {parsedFile.status === 'success' && (
                    <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                  )}
                  {parsedFile.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {parsedFile.status === 'pending' && (
                    <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
                  )}
                </div>
                
                <button
                  onClick={() => removeFile(index)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Processing files...
        </div>
      )}
    </div>
  )
}

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}