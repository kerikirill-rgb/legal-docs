export default function Card({ title, children, actions }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          {title ? <h2 className="text-base font-semibold text-slate-800">{title}</h2> : <span />}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
