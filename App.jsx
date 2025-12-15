import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, Key, ExternalLink, FileText, Trash2, Check, Video, Image as ImageIcon, AlertCircle, Copy, Terminal, Shuffle, Layers, Loader2, X, AlertTriangle } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [query, setQuery] = useState('');
  const [amount, setAmount] = useState(15);
  const [results, setResults] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  
  const [mediaType, setMediaType] = useState('video');
  const [isRandom, setIsRandom] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [minQuality, setMinQuality] = useState('all');
  
  // 下载管理器状态
  const [downloadQueue, setDownloadQueue] = useState({ isOpen: false, items: [], processing: false });
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('pexels_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setShowApiKeyInput(false);
    }
  }, []);

  useEffect(() => {
    setResults([]);
    setSelectedIds(new Set());
    setError('');
    setCurrentPage(1);
  }, [mediaType]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('pexels_api_key', apiKey);
      setShowApiKeyInput(false);
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem('pexels_api_key');
    setApiKey('');
    setShowApiKeyInput(true);
  };

  const getDownloadInfo = (item) => {
    if (mediaType === 'video') {
      if (!item.video_files || item.video_files.length === 0) return null;
      const sorted = [...item.video_files].sort((a, b) => b.width - a.width);
      const best = sorted[0];
      return {
        link: best.link,
        width: best.width,
        height: best.height,
        label: getResolutionLabel(best.width),
        ext: 'mp4'
      };
    } else {
      return {
        link: item.src.original,
        width: item.width,
        height: item.height,
        label: getResolutionLabel(item.width),
        ext: 'jpg'
      };
    }
  };

  const getPreviewSource = (item) => {
    if (mediaType === 'video') {
      if (!item.video_files) return null;
      const sd = item.video_files.find(f => f.quality === 'sd');
      if (sd) return sd.link;
      const sorted = [...item.video_files].sort((a, b) => a.width - b.width);
      return sorted[0]?.link;
    } else {
      return item.src.large || item.src.medium;
    }
  };

  const getResolutionLabel = (width) => {
    if (width >= 3840) return '4K UHD';
    if (width >= 2560) return '2K QHD';
    if (width >= 1920) return 'Full HD';
    if (width >= 1280) return 'HD';
    return 'SD';
  };

  const meetsQuality = (item) => {
    if (minQuality === 'all') return true;
    let width = mediaType === 'video' ? (getDownloadInfo(item)?.width || 0) : item.width;
    switch (minQuality) {
      case 'hd': return width >= 1280;
      case 'fhd': return width >= 1920;
      case '4k': return width >= 3840;
      default: return true;
    }
  };

  const searchMedia = async () => {
    if (!apiKey) {
      setError('请输入 API Key 才能开始搜索');
      setShowApiKeyInput(true);
      return;
    }
    if (!query) {
      setError('请输入搜索关键词');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSelectedIds(new Set());

    try {
      let page = 1;
      const fetchAmount = minQuality === 'all' ? amount : 80;
      const baseUrl = mediaType === 'video' ? 'https://api.pexels.com/videos/search' : 'https://api.pexels.com/v1/search';

      if (isRandom) {
        const metaResponse = await fetch(`${baseUrl}?query=${query}&per_page=1`, {
          headers: { Authorization: apiKey }
        });

        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          const totalResults = metaData.total_results;
          if (totalResults > fetchAmount) {
            const maxPage = Math.ceil(totalResults / fetchAmount);
            const safeMaxPage = Math.min(maxPage, 50);
            if (safeMaxPage > 1) page = Math.floor(Math.random() * safeMaxPage) + 1;
          }
        }
      }

      setCurrentPage(page);

      const response = await fetch(`${baseUrl}?query=${query}&per_page=${fetchAmount}&page=${page}`, {
        headers: { Authorization: apiKey }
      });

      if (!response.ok) throw new Error('网络请求失败，请检查 API Key 或稍后再试');

      const data = await response.json();
      const items = mediaType === 'video' ? data.videos : data.photos;

      let filteredItems = items;
      if (minQuality !== 'all') {
        filteredItems = items.filter(item => meetsQuality(item));
      }

      const finalItems = filteredItems.slice(0, amount);
      
      if (finalItems.length === 0) {
        setError(`未找到相关${mediaType === 'video' ? '视频' : '图片'}，请尝试更换关键词或降低画质要求`);
      } else {
        setResults(finalItems);
        setSelectedIds(new Set(finalItems.map(v => v.id)));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(results.map(v => v.id)));
  };

  const exportTxt = () => {
    const urls = results
      .filter(item => selectedIds.has(item.id))
      .map(item => getDownloadInfo(item)?.link)
      .filter(Boolean)
      .join('\n');
    if (!urls) return alert('没有可导出的链接');
    downloadBlob(urls, `pexels_${mediaType}_links.txt`, 'text/plain');
  };

  const exportScript = (type) => {
    const selectedItems = results.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) return alert('请先选择项目');

    let content = '';
    const filePrefix = mediaType === 'video' ? 'vid' : 'img';
    
    if (type === 'windows') {
      content = '@echo off\nif not exist "downloads" mkdir "downloads"\ncd downloads\n';
      selectedItems.forEach(item => {
        const info = getDownloadInfo(item);
        if (info) {
          const filename = `pexels_${filePrefix}_${item.id}.${info.ext}`;
          content += `curl -L "${info.link}" -o "${filename}"\n`;
        }
      });
      content += 'pause';
    } else {
      content = '#!/bin/bash\nmkdir -p downloads\ncd downloads\n';
      selectedItems.forEach(item => {
        const info = getDownloadInfo(item);
        if (info) {
          const filename = `pexels_${filePrefix}_${item.id}.${info.ext}`;
          content += `curl -L "${info.link}" -o "${filename}"\n`;
        }
      });
    }
    const ext = type === 'windows' ? 'bat' : 'sh';
    downloadBlob(content, `download_${mediaType}s.${ext}`, 'text/plain');
  };

  const downloadBlob = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startBatchDownload = () => {
    const selectedItems = results.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) return alert('请先勾选需要下载的项目');

    const queueItems = selectedItems.map(item => {
      const info = getDownloadInfo(item);
      return {
        id: item.id,
        link: info?.link,
        ext: info?.ext,
        name: `pexels_${mediaType}_${item.id}`,
        status: 'pending',
        errorMsg: ''
      };
    });

    setDownloadQueue({ isOpen: true, items: queueItems, processing: true });
    processQueue(queueItems);
  };

  const processQueue = async (initialItems) => {
    abortControllerRef.current = new AbortController();
    let currentItems = [...initialItems];

    for (let i = 0; i < currentItems.length; i++) {
      if (abortControllerRef.current.signal.aborted) break;

      currentItems = currentItems.map((item, index) => 
        index === i ? { ...item, status: 'fetching' } : item
      );
      setDownloadQueue(prev => ({ ...prev, items: currentItems }));

      const item = currentItems[i];
      
      try {
        if (!item.link) throw new Error('无效链接');

        const timeoutId = setTimeout(() => abortControllerRef.current.abort(), 60000); 

        const response = await fetch(item.link, { 
          signal: abortControllerRef.current.signal,
          referrerPolicy: 'no-referrer'
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        currentItems = currentItems.map((it, idx) => 
          idx === i ? { ...it, status: 'saving' } : it
        );
        setDownloadQueue(prev => ({ ...prev, items: currentItems }));

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${item.name}.${item.ext}`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 1000);

        currentItems = currentItems.map((it, idx) => 
          idx === i ? { ...it, status: 'success' } : it
        );
        setDownloadQueue(prev => ({ ...prev, items: currentItems }));

        await new Promise(r => setTimeout(r, 800));

      } catch (err) {
        console.error(err);
        const isAborted = abortControllerRef.current.signal.aborted;
        
        currentItems = currentItems.map((it, idx) => 
          idx === i ? { ...it, status: 'error', errorMsg: isAborted ? '超时或被取消' : '失败' } : it
        );
        setDownloadQueue(prev => ({ ...prev, items: currentItems }));
        
        if (isAborted) {
             abortControllerRef.current = new AbortController(); 
        }
      }
    }

    setDownloadQueue(prev => ({ ...prev, processing: false }));
  };

  const stopDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setDownloadQueue(prev => ({ ...prev, processing: false }));
  };

  const closeQueue = () => {
    stopDownload();
    setDownloadQueue({ isOpen: false, items: [], processing: false });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20 relative">
      
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 shadow-lg p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${mediaType === 'video' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
              {mediaType === 'video' ? <Video className="w-6 h-6 text-white" /> : <ImageIcon className="w-6 h-6 text-white" />}
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-indigo-200">
              Pexels 资源获取器
            </h1>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            {showApiKeyInput ? (
              <div className="flex flex-1 md:w-80 gap-2">
                <input
                  type="text"
                  placeholder="粘贴 Pexels API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button onClick={saveApiKey} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-sm font-medium">
                  保存
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700">
                <Key className="w-4 h-4 text-emerald-500" />
                <span>API Key 已连接</span>
                <button onClick={clearApiKey} className="text-slate-500 hover:text-red-400 ml-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 mb-8">
          
          <div className="flex justify-center mb-6">
            <div className="bg-slate-900 p-1 rounded-xl flex gap-1 border border-slate-600">
              <button
                onClick={() => setMediaType('video')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                  mediaType === 'video' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4" /> 视频
              </button>
              <button
                onClick={() => setMediaType('photo')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                  mediaType === 'photo' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-4 h-4" /> 图片
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={mediaType === 'video' ? "搜索视频 (如: Rain, City...)" : "搜索图片 (如: Wallpaper, Cat...)"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchMedia()}
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-lg"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              
              <div className="relative w-full md:w-28" title="每页数量">
                 <input
                  type="number"
                  min="1"
                  max="50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-3 pr-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 text-center"
                  placeholder="数量"
                />
                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">个</span>
              </div>

              <div className="relative w-full md:w-36">
                <select
                  value={minQuality}
                  onChange={(e) => setMinQuality(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer text-sm"
                >
                  <option value="all">任意画质</option>
                  <option value="hd">HD (720p+)</option>
                  <option value="fhd">FHD (1080p+)</option>
                  <option value="4k">4K / 原图</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</div>
              </div>

              <button
                onClick={() => setIsRandom(!isRandom)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all border text-sm ${
                  isRandom 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-200' 
                    : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <Shuffle className={`w-4 h-4 ${isRandom ? 'text-purple-400' : ''}`} />
                <span className="hidden md:inline">随机</span>
              </button>
            </div>

            <button
              onClick={searchMedia}
              disabled={loading}
              className={`w-full md:w-auto px-8 py-2.5 rounded-lg font-bold text-lg shadow-lg shadow-indigo-900/20 transition-all transform active:scale-95 whitespace-nowrap ${
                loading 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                  : mediaType === 'video' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 p-4 rounded-xl mb-8 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="flex flex-col xl:flex-row items-center justify-between mb-6 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-start">
               <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors text-sm border border-transparent hover:border-slate-500"
               >
                 {selectedIds.size === results.length && results.length > 0 ? <Check className="w-4 h-4 text-emerald-500"/> : <div className="w-4 h-4 border-2 border-slate-500 rounded-sm"></div>}
                 全选 ({selectedIds.size})
               </button>
               
               <span className="text-slate-500 text-sm border-l border-slate-600 pl-4">
                 第 <span className="text-white font-mono">{currentPage}</span> 页
               </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <span className="text-slate-400 text-sm mr-1 hidden md:inline">选中项:</span>
              
              <button 
                onClick={startBatchDownload}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors border border-emerald-500/50 shadow-lg shadow-emerald-900/20"
              >
                <Layers className="w-4 h-4" />
                浏览器下载
              </button>

              <div className="h-6 w-px bg-slate-600 mx-2 hidden md:block"></div>

              <button onClick={exportTxt} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                <FileText className="w-4 h-4 text-blue-400" />
                链接表
              </button>
              <button onClick={() => exportScript('windows')} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                <Terminal className="w-4 h-4 text-yellow-400" />
                Win脚本
              </button>
              <button onClick={() => exportScript('bash')} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                <Terminal className="w-4 h-4 text-purple-400" />
                Mac/SH
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const downloadInfo = getDownloadInfo(item);
            const previewSrc = getPreviewSource(item);
            
            let badgeColor = "bg-slate-700 text-slate-300";
            if (downloadInfo?.label.includes("4K")) badgeColor = "bg-amber-500/20 text-amber-300 border border-amber-500/50";
            else if (downloadInfo?.label.includes("Full HD")) badgeColor = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50";

            return (
              <div 
                key={item.id} 
                onClick={() => toggleSelect(item.id)}
                className={`group relative bg-slate-800 rounded-xl overflow-hidden border transition-all duration-300 flex flex-col cursor-pointer ${
                  isSelected 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-900/20' 
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="absolute top-3 left-3 z-20">
                  <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors shadow-lg ${
                    isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 border-white/60 hover:bg-black/60'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>

                {mediaType === 'video' && (
                  <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono pointer-events-none text-white">
                    {item.duration}s
                  </div>
                )}

                <div className={`absolute bottom-3 right-3 z-10 backdrop-blur-md px-2 py-1 rounded text-xs font-bold pointer-events-none shadow-sm ${badgeColor}`}>
                  {downloadInfo?.label}
                </div>

                <div className="relative aspect-video bg-black/50 group-hover:brightness-110 transition-all">
                   {mediaType === 'video' ? (
                     <video 
                       controls
                       preload="none"
                       poster={item.image}
                       src={previewSrc}
                       className="w-full h-full object-cover"
                       onClick={(e) => e.stopPropagation()}
                     />
                   ) : (
                     <img 
                       src={previewSrc} 
                       alt={item.alt}
                       className="w-full h-full object-cover"
                     />
                   )}
                </div>

                <div className="p-4 flex-1 flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-400 truncate max-w-[150px]" title={item.url}>
                      ID: {item.id}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {downloadInfo?.width}x{downloadInfo?.height}
                    </span>
                  </div>
                  
                  <div className="flex gap-2 mt-auto">
                     <a 
                       href={downloadInfo?.link} 
                       target="_blank"
                       rel="noreferrer"
                       className={`flex-1 flex items-center justify-center gap-2 text-slate-200 hover:text-white py-2 rounded-lg text-sm font-medium transition-colors ${
                         mediaType === 'video' ? 'bg-emerald-700/50 hover:bg-emerald-600' : 'bg-indigo-700/50 hover:bg-indigo-600'
                       }`}
                     >
                       <Download className="w-4 h-4" />
                       下载
                     </a>
                     <button
                        onClick={() => {
                          if(downloadInfo) {
                            navigator.clipboard.writeText(downloadInfo.link);
                            alert('直链已复制');
                          }
                        }}
                        className="px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center justify-center"
                        title="复制直链"
                     >
                       <Copy className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {downloadQueue.isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-800 border border-slate-600 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              
              <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                <h3 className="font-bold text-white flex items-center gap-2">
                  {downloadQueue.processing ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <Check className="w-5 h-5 text-emerald-500" />}
                  下载队列 ({downloadQueue.items.filter(i => i.status === 'success').length}/{downloadQueue.items.length})
                </h3>
                <div className="flex gap-2">
                   {downloadQueue.processing ? (
                      <button onClick={stopDownload} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded hover:bg-red-500/30">停止</button>
                   ) : (
                      <button onClick={closeQueue} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                   )}
                </div>
              </div>

              <div className="overflow-y-auto p-4 space-y-3 flex-1">
                {downloadQueue.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 text-sm">
                    <div className="flex flex-col flex-1 mr-4">
                      <span className="text-slate-200 truncate font-mono mb-1">{item.name}.{item.ext}</span>
                      
                      <div className="flex items-center gap-2 text-xs">
                        {item.status === 'pending' && <span className="text-slate-500">等待中...</span>}
                        {item.status === 'fetching' && <span className="text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> 缓冲数据...</span>}
                        {item.status === 'saving' && <span className="text-blue-400">正在保存...</span>}
                        {item.status === 'success' && <span className="text-emerald-400">完成</span>}
                        {item.status === 'error' && <span className="text-red-400">{item.errorMsg || '失败'}</span>}
                      </div>
                    </div>

                    {item.status === 'error' && (
                       <a href={item.link} target="_blank" rel="noreferrer" className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white whitespace-nowrap">
                         直接打开
                       </a>
                    )}
                    {item.status === 'success' && <Check className="w-4 h-4 text-emerald-500" />}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-900/80 text-xs text-slate-400 border-t border-slate-700">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p>
                    大文件下载可能需要几十秒缓冲时间，请勿关闭页面。
                    <br/>如果失败，请使用"Win脚本"进行下载。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}