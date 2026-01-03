import type { ReactNode } from "react";
import clsx from "clsx";

export function PageHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
        {props.subtitle && <p className="text-sm mt-1 text-[color:var(--sp-muted)]">{props.subtitle}</p>}
      </div>
      {props.right}
    </div>
  );
}

export function Card(props: { children: ReactNode; className?: string }) {
  return <div className={clsx("glass-panel overflow-hidden", props.className)}>{props.children}</div>;
}

export function CardHeader(props: { title: string; subtitle?: string; className?: string; right?: ReactNode }) {
  return (
    <div className={clsx("px-5 py-4 border-b border-[color:var(--sp-border)] flex items-start justify-between gap-3", props.className)}>
      <div>
        <div className="font-semibold">{props.title}</div>
        {props.subtitle && <div className="text-sm text-[color:var(--sp-muted)]">{props.subtitle}</div>}
      </div>
      {props.right}
    </div>
  );
}

export function CardBody(props: { children: ReactNode; className?: string }) {
  return <div className={clsx("p-5", props.className)}>{props.children}</div>;
}



