/** The Reader's content (DESIGN.md → "Layout"): the cited passage for the last hook pressed. Empty until NB-010. */
export function ReaderContent() {
  return (
    <p className="font-reading text-[1.0625rem] leading-relaxed text-graphite">
      Press a numbered hook in an answer to read the passage here.
    </p>
  );
}

/** The Reader as the right pane, from 1024 px. Tablet opens it as a sheet from Ask's header. */
export function Reader() {
  return (
    <aside aria-labelledby="reader-heading" className="hidden min-h-0 basis-2/5 flex-col border-l border-rule lg:flex">
      <h2 id="reader-heading" className="px-6 pt-5 text-sm font-medium">
        Reader
      </h2>
      <div className="overflow-y-auto px-6 py-4">
        <ReaderContent />
      </div>
    </aside>
  );
}
