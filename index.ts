import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './widgets/widgetTaskHandler';

// Register the widget task handler
registerWidgetTaskHandler(widgetTaskHandler);
