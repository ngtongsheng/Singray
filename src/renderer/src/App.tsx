import { Mic2 } from 'lucide-react'

function App(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Mic2 className="size-12 text-accent" strokeWidth={1.5} />
      <h1 className="font-semibold text-2xl">Singray</h1>
      <p className="text-text-dim">Paste a YouTube link to add your first song</p>
    </div>
  )
}

export default App
