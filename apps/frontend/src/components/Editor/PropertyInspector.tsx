import React, { useState } from 'react';
import { api, getErrorMessage } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import { ProButton } from '../Common/Atoms';
import TelemetryDashboard from './TelemetryDashboard';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, addClip } = useEditorStore();
  const { showToast } = useToastStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'lab'>('properties');

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { 
      selectedClip = clip; 
      parentTrackId = track.id; 
    }
  });

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) { 
      updateClip(parentTrackId, selectedClipId, updates); 
    }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    if (selectedClip) {
      handleUpdate({ data: { ...((selectedClip as Clip).data || {}), ...dataUpdates } });
    }
  };

  const handleTranslateAndVoice = async (targetLang: string) => {
    if (!(selectedClip as Clip)?.data?.content || targetLang === 'none') return;
    setIsProcessing(true);
    showToast(`🧬 正在执行语言炼金: ${targetLang}`, 'info');
    try {
      const { data: trans, error: transError } = await api.api.ai.translate.post({ text: (selectedClip as Clip).data.content, targetLang });
      if (transError) {
        showToast(getErrorMessage(transError), 'error');
        return;
      }

      if (trans && 'translatedText' in trans) {
        handleDataUpdate({ content: trans.translatedText });
        const { data: voice, error: voiceError } = await api.api.ai.tts.post({ text: trans.translatedText });
        
        if (voiceError) {
          showToast(getErrorMessage(voiceError), 'error');
          return;
        }

        if (voice && 'audioUrl' in voice) {
          addClip('track-a1', { id: `alc-${Date.now()}`, start: (selectedClip as Clip).start, end: (selectedClip as Clip).end, src: voice.audioUrl, name: `[${targetLang}] 配音`, type: 'audio' });
          showToast('✨ 炼金成功', 'success');
        }
      }
    } catch (e: any) { 
      showToast(e.message, 'error'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const current = selectedClip as Clip | null;

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header">
        <div className="inspector-tabs">
          <button className={activeTab === 'properties' ? 'active' : ''} onClick={() => setActiveTab('properties')}>属性</button>
          <button className={activeTab === 'lab' ? 'active' : ''} onClick={() => setActiveTab('lab')}>实验室</button>
        </div>
        {current && <span className="clip-type-badge">{current.type}</span>}
      </header>

      <div className="inspector-body">
        {activeTab === 'lab' ? (
          <TelemetryDashboard />
        ) : !current ? (
          <div className="inspector-empty"><p>未选中片段</p><small>点击时间轴片段开始炼金</small></div>
        ) : (
          <>
            <section className="inspector-section">
              <label>片段名称</label>
              <input type="text" value={current.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
            </section>

            {current.type === 'video' && (
              <section className="inspector-section">
                <ProButton onClick={async () => {
                  setIsProcessing(true);
                  const { data } = await api.api.ai.spatial.render.post({ clipId: current.id });
                  if (data?.success) showToast('✨ 3D 重构完成', 'success');
                  setIsProcessing(false);
                }} isLoading={isProcessing} className="w-full">执行 NeRF 3D 重构</ProButton>
              </section>
            )}

            {current.type === 'text' && (
              <section className="inspector-section special">
                <label>文字内容</label>
                <textarea value={current.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} />
                <select onChange={(e) => handleTranslateAndVoice(e.target.value)} disabled={isProcessing} className="pro-select mt-4">
                  <option value="none">多语种翻译...</option>
                  <option value="English">英语 (US)</option>
                  <option value="Japanese">日语 (JP)</option>
                </select>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
