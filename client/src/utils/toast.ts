import { notification } from 'antd';
import React from 'react';

// Setup global config for notification
notification.config({
  placement: 'top', // We will override this with CSS for center
  duration: 3,
});

export const showToast = {
  success: (message: string, key?: string) => {
    notification.success({
      title: 'Success',
      description: message,
      className: 'centered-toast',
      placement: 'top',
      key,
    });
  },
  error: (message: string, key: string = 'singleton-error-toast') => {
    notification.error({
      title: 'Error',
      description: message,
      className: 'centered-toast',
      placement: 'top',
      key,
    });
  },
  warning: (message: string, key?: string) => {
    notification.warning({
      title: 'Warning',
      description: message,
      className: 'centered-toast',
      placement: 'top',
      key,
    });
  },
  loading: (message: string, key: string = 'loading-toast') => {
    notification.info({
      title: 'Processing',
      description: message,
      className: 'centered-toast',
      duration: 0, // Manual close needed or wait for next update
      key,
    });
  },
  dismiss: (key?: string) => notification.destroy(key),
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    }
  ) => {
    const key = 'updatable-notif';
    notification.info({
      title: 'Loading',
      description: messages.loading,
      key,
      className: 'centered-toast',
      duration: 0,
    });

    promise
      .then(data => {
        const successMsg =
          typeof messages.success === 'function' ? messages.success(data) : messages.success;
        notification.success({
          title: 'Success',
          description: successMsg,
          key,
          duration: 3,
          className: 'centered-toast',
        });
      })
      .catch(err => {
        const errorMsg =
          typeof messages.error === 'function' ? messages.error(err) : messages.error;
        notification.error({
          title: 'Error',
          description: errorMsg,
          key,
          duration: 3,
          className: 'centered-toast',
        });
      });
    return promise;
  },
};
