export default function NotFound() {
  return (
    <main className="docs">
      <p className="eyebrow">Missing</p>
      <h1>Not found</h1>
      <p className="lede">That recipe or version is not in the registry.</p>
      <a className="back" href="/">
        Back to recipes
      </a>
    </main>
  );
}
