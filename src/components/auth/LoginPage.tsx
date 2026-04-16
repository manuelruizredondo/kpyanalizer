import React, { useState } from 'react'
import { Code } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export const LoginPage: React.FC = () => {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al iniciar sesión. Por favor, intenta de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f2f1] to-[#e8ece9] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white rounded-2xl shadow-lg">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-center mb-8">
            <Code className="w-8 h-8 text-[#006c48] mr-3" />
            <h1 className="text-2xl font-bold text-[#1a2e23] font-['Plus_Jakarta_Sans']">KPY CSS Analyzer</h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1a2e23] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#f0f2f1] rounded-xl border-0 focus:ring-2 focus:ring-[#006c48] focus:border-transparent outline-none transition"
                placeholder="tu@email.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1a2e23] mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#f0f2f1] rounded-xl border-0 focus:ring-2 focus:ring-[#006c48] focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-[#fef2f1] rounded-xl border-0">
                <p className="text-sm text-[#9e2b25]">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#012d1d] hover:bg-[#0a1f18] text-white font-medium py-2 rounded-full transition"
            >
              {loading ? 'Cargando...' : 'Entrar'}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-[#3d5a4a] mt-6">
            Herramienta interna del equipo KPY
          </p>
        </div>
      </Card>
    </div>
  )
}
