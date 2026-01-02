import type { ReactNode } from "react";
import clsx from "clsx";

export function PageHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
        {props.subtitle && <p className="text-sm text-slate-500 mt-1">{props.subtitle}</p>}
      </div>
      {props.right}
    </div>
  );
}

export function Card(props: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-2xl border border-slate-200 bg-white shadow-sm", props.className)}>{props.children}</div>;
}

export function CardHeader(props: { title: string; subtitle?: string; className?: string; right?: ReactNode }) {
  return (
    <div className={clsx("px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3", props.className)}>
      <div>
        <div className="font-semibold">{props.title}</div>
        {props.subtitle && <div className="text-sm text-slate-500">{props.subtitle}</div>}
      </div>
      {props.right}
    </div>
  );
}

export function CardBody(props: { children: ReactNode; className?: string }) {
  return <div className={clsx("p-5", props.className)}>{props.children}</div>;
}


