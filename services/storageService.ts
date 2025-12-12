import { Meeting } from '../types';

const STORAGE_KEY = 'smartminutes_data_v1';

export const getMeetings = (): Meeting[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load meetings", e);
    return [];
  }
};

export const saveMeeting = (meeting: Meeting): void => {
  const meetings = getMeetings();
  const existingIndex = meetings.findIndex(m => m.id === meeting.id);
  
  if (existingIndex >= 0) {
    meetings[existingIndex] = meeting;
  } else {
    meetings.unshift(meeting);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
};

export const deleteMeeting = (id: string): void => {
  const meetings = getMeetings();
  const filtered = meetings.filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};