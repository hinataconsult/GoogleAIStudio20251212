import React, { useState, useEffect, useCallback } from 'react';
import { Meeting, ActionItem } from './types';
import * as Storage from './services/storageService';
import * as Gemini from './services/geminiService';
import { 
  PlusIcon, CalendarIcon, UsersIcon, SparklesIcon, 
  ChevronLeftIcon, SaveIcon, TrashIcon, BotIcon, SearchIcon,
  FileTextIcon, CheckCircleIcon, ClockIcon
} from './components/Icons';

// --- Sub-components for better organization ---

const MeetingCard: React.FC<{ meeting: Meeting; onClick: () => void }> = ({ meeting, onClick }) => (
  <div 
    onClick={onClick}
    className="group bg-white hover:bg-indigo-50 border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between h-full relative overflow-hidden"
  >
    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    
    <div>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xl font-bold text-gray-800 line-clamp-2">{meeting.title || '無題の会議'}</h3>
        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
          {meeting.date}
        </span>
      </div>
      
      <p className="text-gray-500 text-sm mb-4 line-clamp-3">
        {meeting.summary || meeting.rawNotes || 'メモはありません...'}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {meeting.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">#{tag}</span>
        ))}
      </div>
    </div>

    <div className="flex items-center justify-between text-sm text-gray-400 mt-auto pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1">
            <UsersIcon className="w-4 h-4" />
            <span>{meeting.participants.length}名</span>
        </div>
        <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            <span>{meeting.actionItems.filter(i => i.status === 'completed').length}/{meeting.actionItems.length}</span>
        </div>
    </div>
  </div>
);

const ActionItemRow: React.FC<{ item: ActionItem, onToggle: () => void, onDelete: () => void }> = ({ item, onToggle, onDelete }) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${item.status === 'completed' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 shadow-sm'}`}>
        <button onClick={onToggle} className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${item.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-500'}`}>
            {item.status === 'completed' && <CheckCircleIcon className="w-3 h-3 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${item.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.task}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="flex items-center gap-1">
                    <UsersIcon className="w-3 h-3" /> {item.assignee || '未定'}
                </span>
                {item.dueDate && (
                    <span className={`flex items-center gap-1 ${new Date(item.dueDate) < new Date() && item.status !== 'completed' ? 'text-red-500' : ''}`}>
                        <CalendarIcon className="w-3 h-3" /> {item.dueDate}
                    </span>
                )}
            </div>
        </div>
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1">
            <TrashIcon className="w-4 h-4" />
        </button>
    </div>
);

export default function App() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load
  useEffect(() => {
    setMeetings(Storage.getMeetings());
  }, [view]);

  const handleCreateNew = () => {
    const newMeeting: Meeting = {
      id: Storage.generateId(),
      title: '',
      date: new Date().toISOString().split('T')[0],
      participants: [],
      rawNotes: '',
      summary: '',
      actionItems: [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCurrentMeeting(newMeeting);
    setView('edit');
  };

  const handleEdit = (meeting: Meeting) => {
    setCurrentMeeting({ ...meeting }); // Clone to avoid direct mutation issues
    setView('edit');
  };

  const handleSave = () => {
    if (currentMeeting) {
      const updated = { ...currentMeeting, updatedAt: Date.now() };
      Storage.saveMeeting(updated);
      setMeetings(Storage.getMeetings());
      setView('list');
    }
  };

  const handleDelete = () => {
    if (currentMeeting && confirm('本当にこの議事録を削除しますか？')) {
      Storage.deleteMeeting(currentMeeting.id);
      setMeetings(Storage.getMeetings());
      setView('list');
    }
  };

  // --- AI Functions ---

  const handleAISummarize = async () => {
    if (!currentMeeting?.rawNotes) return;
    setIsAiLoading(true);
    try {
      const summary = await Gemini.summarizeMeeting(currentMeeting.rawNotes);
      const tags = await Gemini.suggestTags(currentMeeting.rawNotes);
      setCurrentMeeting(prev => prev ? { ...prev, summary, tags: [...new Set([...prev.tags, ...tags])] } : null);
    } catch (e) {
      alert("AI処理中にエラーが発生しました。");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIExtractTasks = async () => {
    if (!currentMeeting?.rawNotes) return;
    setIsAiLoading(true);
    try {
      const tasks = await Gemini.extractActionItems(currentMeeting.rawNotes);
      const newItems: ActionItem[] = tasks.map(t => ({
        id: Storage.generateId(),
        task: t.task || 'タスク',
        assignee: t.assignee || '未定',
        dueDate: t.dueDate,
        status: 'pending'
      }));
      
      setCurrentMeeting(prev => prev ? { ...prev, actionItems: [...prev.actionItems, ...newItems] } : null);
    } catch (e) {
      alert("タスク抽出中にエラーが発生しました。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Filtered List ---
  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- Views ---

  const renderListView = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col h-auto md:h-screen sticky top-0 z-10">
        <div className="p-6">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-2xl mb-8">
                <BotIcon className="w-8 h-8" />
                <span>SmartMinutes</span>
            </div>
            
            <button 
                onClick={handleCreateNew}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
            >
                <PlusIcon className="w-5 h-5" />
                新規作成
            </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
            <div className="px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu</div>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-indigo-600 bg-indigo-50 rounded-lg font-medium">
                <FileTextIcon className="w-5 h-5" />
                すべての議事録
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                <CheckCircleIcon className="w-5 h-5" />
                タスク一覧 <span className="text-xs ml-auto bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Coming Soon</span>
            </button>
        </nav>

        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
             Powered by Gemini 2.5
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">議事録一覧</h1>
                    <p className="text-gray-500">最近のミーティング履歴</p>
                </div>
                <div className="relative w-full md:w-96">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="検索 (タイトル、タグ...)" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
                    />
                </div>
            </header>

            {filteredMeetings.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                        <FileTextIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">議事録がありません</h3>
                    <p className="text-gray-500 mt-1 mb-6">新しい会議の記録を作成しましょう</p>
                    <button onClick={handleCreateNew} className="text-indigo-600 font-medium hover:underline">
                        新規作成する
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMeetings.map(meeting => (
                        <MeetingCard key={meeting.id} meeting={meeting} onClick={() => handleEdit(meeting)} />
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );

  const renderEditView = () => {
    if (!currentMeeting) return null;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Toolbar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>
                <h1 className="text-lg font-bold text-gray-800 hidden md:block">
                    {currentMeeting.id ? '議事録の編集' : '新規作成'}
                </h1>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                    <TrashIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={handleSave} 
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-md shadow-indigo-100 transition-all active:scale-95"
                >
                    <SaveIcon className="w-4 h-4" />
                    保存
                </button>
            </div>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left: Input Area */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 border-r border-gray-100">
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Meta Data */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">タイトル</label>
                            <input 
                                type="text" 
                                value={currentMeeting.title}
                                onChange={(e) => setCurrentMeeting({ ...currentMeeting, title: e.target.value })}
                                placeholder="例：週次プロジェクト定例"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">日時</label>
                            <div className="relative">
                                <input 
                                    type="date" 
                                    value={currentMeeting.date}
                                    onChange={(e) => setCurrentMeeting({ ...currentMeeting, date: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                                <CalendarIcon className="absolute right-3 top-2.5 text-gray-400 w-5 h-5 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">参加者</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={currentMeeting.participants.join(', ')}
                                onChange={(e) => setCurrentMeeting({ ...currentMeeting, participants: e.target.value.split(',').map(s => s.trim()) })}
                                placeholder="カンマ区切りで入力 (例: 山田太郎, 佐藤花子)"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            <UsersIcon className="absolute right-3 top-2.5 text-gray-400 w-5 h-5 pointer-events-none" />
                        </div>
                    </div>

                    {/* Editor Area */}
                    <div className="space-y-3 flex-1 flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <FileTextIcon className="w-4 h-4" /> 会議メモ (Raw Notes)
                            </label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleAISummarize}
                                    disabled={isAiLoading || !currentMeeting.rawNotes}
                                    className="text-xs flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-full hover:shadow-lg disabled:opacity-50 transition-all"
                                >
                                    <SparklesIcon className="w-3 h-3" /> 
                                    {isAiLoading ? 'AI思考中...' : 'AI要約'}
                                </button>
                                <button 
                                    onClick={handleAIExtractTasks}
                                    disabled={isAiLoading || !currentMeeting.rawNotes}
                                    className="text-xs flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-50 disabled:opacity-50 transition-all"
                                >
                                    <CheckCircleIcon className="w-3 h-3" /> 
                                    {isAiLoading ? 'AI思考中...' : 'タスク抽出'}
                                </button>
                            </div>
                        </div>
                        <textarea 
                            value={currentMeeting.rawNotes}
                            onChange={(e) => setCurrentMeeting({ ...currentMeeting, rawNotes: e.target.value })}
                            placeholder="ここに会議のメモを自由に入力してください..."
                            className="w-full flex-1 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all font-mono text-sm leading-relaxed"
                        />
                    </div>
                </div>
            </div>

            {/* Right: Output Area (Summary & Actions) */}
            <div className="w-full lg:w-[450px] bg-gray-50/50 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-200">
                <div className="p-6 space-y-6 overflow-y-auto h-full">
                    
                    {/* Summary Section */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <BotIcon className="w-4 h-4 text-purple-600" /> 
                            AI要約
                        </h3>
                        {currentMeeting.summary ? (
                            <div className="prose prose-sm prose-indigo max-w-none text-gray-600 bg-gray-50 p-4 rounded-xl">
                                <div className="whitespace-pre-wrap">{currentMeeting.summary}</div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                まだ要約がありません。<br/>メモを入力してAIボタンを押してください。
                            </div>
                        )}
                        
                        {/* Tags */}
                        {currentMeeting.tags.length > 0 && (
                             <div className="mt-4 flex flex-wrap gap-2">
                                {currentMeeting.tags.map(tag => (
                                    <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100">
                                        #{tag}
                                    </span>
                                ))}
                             </div>
                        )}
                    </div>

                    {/* Action Items Section */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                アクションアイテム
                            </h3>
                            <button 
                                onClick={() => {
                                    const newItem: ActionItem = { id: Storage.generateId(), task: '新しいタスク', assignee: '', status: 'pending' };
                                    setCurrentMeeting({ ...currentMeeting, actionItems: [...currentMeeting.actionItems, newItem] });
                                }}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-md transition-colors"
                            >
                                + 追加
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {currentMeeting.actionItems.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    タスクはありません
                                </div>
                            ) : (
                                currentMeeting.actionItems.map((item, idx) => (
                                    <ActionItemRow 
                                        key={item.id} 
                                        item={item} 
                                        onToggle={() => {
                                            const updated = [...currentMeeting.actionItems];
                                            updated[idx].status = updated[idx].status === 'completed' ? 'pending' : 'completed';
                                            setCurrentMeeting({ ...currentMeeting, actionItems: updated });
                                        }}
                                        onDelete={() => {
                                            const updated = currentMeeting.actionItems.filter(i => i.id !== item.id);
                                            setCurrentMeeting({ ...currentMeeting, actionItems: updated });
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
      </div>
    );
  };

  return view === 'list' ? renderListView() : renderEditView();
}