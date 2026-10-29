"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import styles from "./page-frame.module.css";

const PageTitleContext = createContext<{
  title: string | null;
  setTitle: (title: string | null) => void;
} | null>(null);

export function AdminPageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function useAdminPageTitle() {
  return useContext(PageTitleContext)?.title;
}

export function AdminPageHeader({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  id?: string;
}) {
  const setTitle = useContext(PageTitleContext)?.setTitle;
  useEffect(() => {
    setTitle?.(title);
    return () => setTitle?.(null);
  }, [title, setTitle]);

  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 id={id} className="t-h2">
          {title}
        </h1>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export function AdminToolbar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>{children}</div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

export function AdminTableCard({ children }: { children: ReactNode }) {
  return <div className={styles.tableCard}>{children}</div>;
}
