#import <React/RCTBridgeModule.h>

/// Objective-C bridge for the Swift WidgetDataModuleIOS native module.
/// This exposes the module to React Native's bridge.
@interface RCT_EXTERN_MODULE(WidgetDataModuleIOS, NSObject)

RCT_EXTERN_METHOD(setWidgetData:(NSString *)jsonString
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setThemeMode:(NSString *)themeMode
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getWidgetData:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

@end
