export default function AssinaturaExpiradaPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gray-50">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Assinatura Expirada</h1>
      <p className="text-slate-500 mb-6 max-w-sm">
        Sua assinatura do FarmaSign expirou ou foi cancelada. Entre em contato com o suporte para renovar e continuar emitindo DSFs.
      </p>
      <a
        href="mailto:suporte@farmasign.com.br"
        className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
      >
        Falar com o Suporte
      </a>
    </div>
  )
}
