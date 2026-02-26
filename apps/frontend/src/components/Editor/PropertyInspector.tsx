import React, { useState } from 'react';
import { api } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, addClip } = useEditorStore();
  const { showToast } = useToastStore();
  const [isProcessing, setIsProcessing] = useState(false);

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { selectedClip = clip; parentTrackId = track.id; }
  });

  if (!selectedClip || !parentTrackId) {
    return <div className="inspector-empty glass-panel"><p>未选中任何片段</p><small>在时间轴上点击片段进行编辑</small></div>;
  }

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) { updateClip(parentTrackId, selectedClipId, updates); }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    handleUpdate({ data: { ...(selectedClip?.data || {}), ...dataUpdates } });
  };

  const handleTranslateAndVoice = async (targetLang: string) => {
    if (!selectedClip || !selectedClip.data?.content || targetLang === 'none') return;
    setIsProcessing(true);
    showToast(`🌍 正在炼金：重塑语言灵魂...`, 'info');
    try {
      const { data: trans } = await api.api.ai.translate.post({ text: selectedClip.data.content, targetLang });
      if (trans && 'translatedText' in trans) {
        handleDataUpdate({ content: trans.translatedText });
        const { data: voice } = await api.api.ai.tts.post({ text: trans.translatedText });
        if (voice?.success) {
          addClip('track-a1', { id: `alc-v-${Date.now()}`, start: selectedClip.start, end: selectedClip.end, src: voice.audioUrl, name: `[${targetLang}] 配音`, type: 'audio' });
          showToast(`✨ 炼金成功`, 'success');
        }
      }
    } finally { setIsProcessing(false); }
  };

  // 视觉炼金：风格迁移
  const handleStyleAlchemy = async (style: string) => {
    if (!selectedClip || style === 'none') return;
    setIsProcessing(true);
    showToast(`🎨 正在视觉炼金：应用 [${style}] 艺术风格...`, 'info');
    try {
      const { data } = await api.api.ai.alchemy['style-transfer'].post({ clipId: selectedClip.id, style });
      if (data?.success) {
        showToast(`✨ 视觉重塑任务已提交，完成后将自动替换。`, 'success');
      }
    } finally { setIsProcessing(false); }
  };

  const handleAiRepair = async () => {
    if (!selectedClip) return;
    const problem = window.prompt('描述问题:');
    if (!problem) return;
    setIsProcessing(true);
    try {
      const { data } = await api.api.ai.repair.post({ description: problem });
      if (data && 'fixPrompt' in data) { alert(data.fixPrompt); handleDataUpdate({ repairPrompt: data.fixPrompt }); }
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header"><h3>属性检查器</h3><span className="clip-type-badge">{selectedClip.type}</span></header>
      <div className="inspector-body">
        <section className="inspector-section">
          <label>名称</label>
          <input type="text" value={selectedClip.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
        </section>

        {selectedClip.type === 'video' && (
          <section className="inspector-section">
            <div className="alchemy-tools">
              <label style={{ fontSize: '0.7rem', color: '#38bdf8' }}>💎 视觉炼金：风格重塑</label>
              <div className="style-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
                <button onClick={() => handleStyleAlchemy('van-gogh')} style={{ fontSize: '0.7rem', padding: '4px', background: '#333' }}>🌻 梵高油画</button>
                <button onClick={() => handleStyleAlchemy('cyberpunk')} style={{ fontSize: '0.7rem', padding: '4px', background: '#333' }}>🌃 赛博朋克</button>
                <button onClick={() => handleStyleAlchemy('ghibli')} style={{ fontSize: '0.7rem', padding: '4px', background: '#333' }}>☁️ 吉卜力</button>
                <button onClick={() => handleStyleAlchemy('sketch')} style={{ fontSize: '0.7rem', padding: '4px', background: '#333' }}>✏️ 素描</button>
              </div>
            </div>
            
            <label style={{ marginTop: '1rem' }}>色彩滤镜</label>
            <select value={selectedClip.data?.filter || 'none'} onChange={(e) => handleDataUpdate({ filter: e.target.value })} style={{ background: '#000', color: '#ccc', border: '1px solid #2a2a2a', padding: '4px' }}>
              <option value="none">无</option><option value="grayscale(100%)">黑白</option><option value="sepia(50%)">复古</option>
            </select>
            <button className="btn-repair" onClick={handleAiRepair} disabled={isProcessing} style={{ marginTop: '1rem', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#aaa', border: '1px solid #333', padding: '0.6rem', borderRadius: '8px' }}>{isProcessing ? '🔍 诊断中...' : '🛠️ AI 画面修复'}</button>
          </section>
        )}

        {selectedClip.type === 'text' && (
          <section className="inspector-section special">
            <textarea value={selectedClip.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} style={{ height: '100px' }} />
            <div className="alchemy-tools" style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#a855f7' }}>🧬 炼金：语种转换</label>
              <select onChange={(e) => handleTranslateAndVoice(e.target.value)} disabled={isProcessing} style={{ width: '100%', background: '#000', color: '#ccc', border: '1px solid #333', padding: '6px', borderRadius: '4px', marginTop: '4px' }}>
                <option value="none">选择语言...</option>
                <option value="English">英语 (US)</option>
                <option value="Japanese">日语 (JP)</option>
              </select>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
