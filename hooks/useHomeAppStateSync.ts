import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { format } from 'date-fns';

type UseHomeAppStateSyncParams = {
    currentDay: number;
    currentDate: Date;
    setCurrentDate: Dispatch<SetStateAction<Date>>;
    setCurrentDay: Dispatch<SetStateAction<number>>;
    setLastRefreshDate: Dispatch<SetStateAction<string>>;
    setAppState: Dispatch<SetStateAction<AppStateStatus>>;
};

export function useHomeAppStateSync({
    currentDay,
    currentDate,
    setCurrentDate,
    setCurrentDay,
    setLastRefreshDate,
    setAppState,
}: UseHomeAppStateSyncParams): void {
    const currentDayRef = useRef(currentDay);
    const currentDateRef = useRef(currentDate);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        currentDayRef.current = currentDay;
    }, [currentDay]);

    useEffect(() => {
        currentDateRef.current = currentDate;
    }, [currentDate]);

    useEffect(() => {
        const syncDateWithSystem = () => {
            if (currentDayRef.current !== 0) return;

            const now = new Date();
            const systemDateStr = format(now, 'yyyy-MM-dd');
            const appDateStr = format(currentDateRef.current, 'yyyy-MM-dd');

            if (systemDateStr !== appDateStr) {
                console.log('[PRYR_DEBUG] syncDateWithSystem: date changed', appDateStr, '->', systemDateStr);
                setCurrentDate(now);
                setCurrentDay(0);
                setLastRefreshDate('');
            }
        };

        syncDateWithSystem();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
                syncDateWithSystem();
            }

            appStateRef.current = nextAppState;
            setAppState(nextAppState);
        });

        const minuteTimer = setInterval(syncDateWithSystem, 60000);

        return () => {
            subscription.remove();
            clearInterval(minuteTimer);
        };
    }, [setAppState, setCurrentDate, setCurrentDay, setLastRefreshDate]);
}
