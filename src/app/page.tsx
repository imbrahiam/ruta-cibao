export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Ruta Cibao</h1>
      <p className="text-balance opacity-80">
        Mapa cívico de la provincia Santiago Rodríguez. En construcción.
      </p>
      <a className="underline underline-offset-4" href="/api/docs">
        Documentación de la API
      </a>
    </main>
  );
}
