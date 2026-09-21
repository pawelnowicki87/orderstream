import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  message: string;
  link?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {

  readonly toasts = signal<Toast[]>([]);

  private nextId = 1;

  show(toast: Omit<Toast, 'id'>, durationMs = 5000): void {
    const id = this.nextId++;
    // Newest on top, and never more than four on screen at once.
    this.toasts.update(current => [{ ...toast, id }, ...current].slice(0, 4));
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update(current => current.filter(toast => toast.id !== id));
  }
}
