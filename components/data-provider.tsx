"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { store, StoreError, type StoreErrorKind } from "@/lib/store";
import { emptyAppData, type AppData } from "@/lib/types";

/**
 * Bridges the storage boundary to React.
 *
 * Data is loaded in an effect, never during render, so the server-rendered
 * markup and the first client render agree (no hydration mismatch). Consumers
 * read `isLoading` and show a skeleton until the real data arrives.
 *
 * Nguồn dữ liệu là một listener realtime của Firestore: mọi thay đổi — kể cả
 * do máy khác thực hiện — tự chảy về đây. Vì vậy `run` không cần đọc lại sau
 * mỗi lần ghi, và không còn listener `storage` cho nhiều tab như bản cũ.
 */

export interface StoreErrorState {
  kind: StoreErrorKind;
  message: string;
}

interface DataContextValue {
  data: AppData;
  /** True until the first snapshot from Firestore arrives. */
  isLoading: boolean;
  /** Set when data is corrupt, over quota, or Firebase is unreachable. */
  error: StoreErrorState | null;
  /**
   * Đọc lại từ Firestore. Listener realtime đã tự cập nhật sau mỗi lần ghi,
   * nên hàm này chỉ dùng khi cần buộc tải lại (vd sau khi nhập tệp sao lưu).
   */
  refresh: () => Promise<void>;
  /**
   * Run a mutation against the store, then refresh. Surfaces quota errors as
   * `error` instead of throwing, so a full disk cannot crash the page.
   */
  run: <T>(action: () => Promise<T>) => Promise<T | undefined>;
  clearError: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  // Always start from empty data so SSR and the first client render match.
  const [data, setData] = useState<AppData>(emptyAppData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<StoreErrorState | null>(null);

  const read = useCallback(async () => {
    try {
      const next = await store.getAll();
      setData(next);
      setError(null);
    } catch (caught) {
      if (caught instanceof StoreError) {
        setError({ kind: caught.kind, message: caught.message });
      } else {
        setError({
          kind: "corrupt",
          message: "Không đọc được dữ liệu đã lưu.",
        });
      }
    }
  }, []);

  /**
   * Mở listener realtime khi mount. Firestore gửi snapshot đầu tiên rồi đẩy
   * tiếp mọi thay đổi, kể cả từ thiết bị khác — nên đây là nguồn dữ liệu duy
   * nhất, thay cho việc đọc lại sau từng thao tác.
   */
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (next) => {
        setData(next);
        setError(null);
        setIsLoading(false);
      },
      (caught) => {
        setError({ kind: caught.kind, message: caught.message });
        setIsLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    await read();
  }, [read]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        // Không gọi `read()` sau khi ghi: listener realtime đã đẩy kết quả về,
        // và Firestore áp dụng thay đổi cục bộ ngay lập tức nên giao diện
        // không phải chờ máy chủ phản hồi.
        return await action();
      } catch (caught) {
        if (caught instanceof StoreError) {
          setError({ kind: caught.kind, message: caught.message });
          return undefined;
        }
        throw caught;
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<DataContextValue>(
    () => ({ data, isLoading, error, refresh, run, clearError }),
    [data, isLoading, error, refresh, run, clearError],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData phải được dùng bên trong <DataProvider>.");
  }
  return context;
}

/* ------------------------------------------------------------------ *
 * Derived selectors — convenience wrappers so pages stay declarative
 * ------------------------------------------------------------------ */

/** Active (non-archived) students, sorted by Vietnamese name order. */
export function useActiveStudents() {
  const { data } = useData();
  return useMemo(
    () =>
      data.students
        .filter((s) => !s.archived)
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [data.students],
  );
}

export function useAllStudents() {
  const { data } = useData();
  return useMemo(
    () => [...data.students].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [data.students],
  );
}

/** Fast id -> student lookup for the grid and tables. */
export function useStudentMap() {
  const { data } = useData();
  return useMemo(() => new Map(data.students.map((s) => [s.id, s])), [data.students]);
}
