import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';

dayjs.extend(buddhistEra);
dayjs.locale('th');

export function formatThaiDate(date: any) {
  if (!date) return '-';
  // Handle Firestore Timestamp
  const d = date?.toDate ? date.toDate() : new Date(date);
  return dayjs(d).format('DD MMM BBBB');
}

export function formatThaiDateTime(date: any) {
  if (!date) return '-';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return dayjs(d).format('DD MMM BBBB HH:mm');
}
