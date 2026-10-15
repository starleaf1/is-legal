import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastOptions {
  content: string;
  toastType?: string;
  action?: {
    label: string;
    method: () => void;
  };
}

export const useToastStore = defineStore('toast', () => {
  const message = ref<string|null>(null);
  const isDisplayed = ref(false);
  const type = ref();
  const toastAction = ref<ToastOptions['action'] | undefined>();

  const displayToast = ({ content, toastType, action }: ToastOptions) => {
    message.value = content;
    type.value = toastType;
    toastAction.value = action;
    isDisplayed.value = true
  };

  const clearToast = () => {
    isDisplayed.value = false;
    message.value = null;
    isDisplayed.value = false;
    type.value = undefined;
    toastAction.value = undefined;
  };

  watchEffect(() => {
    if (!isDisplayed.value) {
      clearToast();
    }
  })

  return {
    message, isDisplayed, type, displayToast, clearToast, toastAction,
  };
});
