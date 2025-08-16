declare global {
  // Add the debug function for notifications
  var showTestNotification: () => void;
  
  // Extend the global namespace
  var global: {
    showTestNotification?: () => void;
  };
}

export {};
