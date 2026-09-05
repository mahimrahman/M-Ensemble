/**
 * Where you are, and where you're looking.
 *
 * Two cities, deliberately separate:
 *   detectedCity   where the phone says you physically are — gates sign-ups
 *   browsingCity   what the app is showing — defaults to detected, but you
 *                  can look at any city's mosques and events
 *
 * You can browse Toronto from Montréal; you can't claim a Toronto shift from
 * Montréal. That rule is `canActIn`, and only the post detail enforces it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CITIES, DEFAULT_CITY, cityAt, cityById, type City } from '@/lib/cities';

const PROMPT_KEY = 'mensemble.location.prompted';
const BROWSE_KEY = 'mensemble.location.browse';
const DETECTED_KEY = 'mensemble.location.detected';

/**
 *   idle         never asked
 *   locating     permission granted, waiting on a fix
 *   granted      we have a fix (detectedCity may still be null: outside coverage)
 *   denied       the user said no, or the platform did
 *   unavailable  no location services at all (some browsers, simulators)
 */
export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

interface LocationContextValue {
  /** True once the first-run popup has been answered either way. */
  promptSeen: boolean;
  status: LocationStatus;
  detectedCity: City | null;
  browsingCity: City;
  /** True when the app is showing somewhere other than where you are. */
  isBrowsingElsewhere: boolean;
  setBrowsingCity: (city: City) => void;
  /** Ask for permission, take a fix, resolve the city. Marks the prompt seen. */
  requestLocation: () => Promise<void>;
  dismissPrompt: () => void;
  /** Whether a sign-up in `cityId` is allowed from where you are. */
  canActIn: (cityId: string) => boolean;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [promptSeen, setPromptSeen] = useState(true); // true until storage says otherwise
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [detectedCity, setDetectedCity] = useState<City | null>(null);
  const [browsingCity, setBrowsingCityState] = useState<City>(DEFAULT_CITY);

  const locate = useCallback(async (): Promise<void> => {
    setStatus('locating');
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const city = cityAt({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setDetectedCity(city);
      setStatus('granted');
      void AsyncStorage.setItem(DETECTED_KEY, city?.id ?? '').catch(() => {});
      // First fix wins the browsing city, unless the user already chose one.
      const chosen = await AsyncStorage.getItem(BROWSE_KEY);
      if (city && !chosen) setBrowsingCityState(city);
    } catch {
      setStatus('unavailable');
    }
  }, []);

  // Restore what we knew, then quietly refresh the fix if we're allowed to.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [prompted, browse, detected] = await Promise.all([
        AsyncStorage.getItem(PROMPT_KEY),
        AsyncStorage.getItem(BROWSE_KEY),
        AsyncStorage.getItem(DETECTED_KEY),
      ]);
      if (cancelled) return;
      setPromptSeen(prompted === 'true');
      const remembered = cityById(browse);
      if (remembered) setBrowsingCityState(remembered);
      const last = cityById(detected);
      if (last) {
        setDetectedCity(last);
        if (!remembered) setBrowsingCityState(last);
      }

      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.granted) await locate();
        else if (prompted === 'true') setStatus('denied');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locate]);

  const requestLocation = useCallback(async () => {
    setPromptSeen(true);
    void AsyncStorage.setItem(PROMPT_KEY, 'true').catch(() => {});
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return;
      }
      await locate();
    } catch {
      setStatus('unavailable');
    }
  }, [locate]);

  const dismissPrompt = useCallback(() => {
    setPromptSeen(true);
    void AsyncStorage.setItem(PROMPT_KEY, 'true').catch(() => {});
  }, []);

  const setBrowsingCity = useCallback((city: City) => {
    setBrowsingCityState(city);
    void AsyncStorage.setItem(BROWSE_KEY, city.id).catch(() => {});
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      promptSeen,
      status,
      detectedCity,
      browsingCity,
      isBrowsingElsewhere: detectedCity !== null && detectedCity.id !== browsingCity.id,
      setBrowsingCity,
      requestLocation,
      dismissPrompt,
      canActIn: (cityId) => detectedCity?.id === cityId,
    }),
    [
      promptSeen,
      status,
      detectedCity,
      browsingCity,
      setBrowsingCity,
      requestLocation,
      dismissPrompt,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>.');
  return ctx;
}

export { CITIES };
