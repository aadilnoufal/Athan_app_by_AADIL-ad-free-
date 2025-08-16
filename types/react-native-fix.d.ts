import 'react-native';

declare module 'react-native' {
  namespace ReactNative {
    interface NativeMethods {
      refs?: any;
    }
    
    interface ViewComponent extends NativeMethods {
      refs?: any;
    }
    
    interface TextComponent extends NativeMethods {
      refs?: any;
    }
    
    interface SafeAreaViewComponent extends NativeMethods {
      refs?: any;
    }
    
    interface SwitchComponent extends NativeMethods {
      refs?: any;
    }
    
    interface ScrollViewComponent extends NativeMethods {
      refs?: any;
    }
    
    interface StatusBarComponent extends NativeMethods {
      refs?: any;
    }
  }
}
