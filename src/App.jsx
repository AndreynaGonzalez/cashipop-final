import { useState, useEffect, useCallback } from 'react'
import { getOnboardingState, getProfileConfig, clearOnboardingState, clearProfileConfig } from './lib/storage'
import OnboardingRouter from './components/onboarding/OnboardingRouter'
import PersonalDashboard from './components/dashboard/personal/PersonalDashboard'
import BusinessDashboard from './components/dashboard/business/BusinessDashboard'
import Toast from './components/ui/Toast'
import Confirm from './components/ui/Confirm'
import { Settings, RotateCcw } from 'lucide-react'
import { T } from './lib/theme'

// ─── Update Banner (PWA) ─────────────────────────────────────────────────────
function UpdateBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (window.__CASHIPOP_UPDATE) setShow(true)
    const handler = () => setShow(true)
    window.addEventListener('cashipop-update', handler)
    return () => window.removeEventListener('cashipop-update', handler)
  }, [])
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: `linear-gradient(135deg, ${T.brand}, #3D2539)`,
      padding: '12px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Nueva mejora disponible</span>
      <button onClick={() => {
        setShow(false)
        if (window.__CASHIPOP_DO_UPDATE) window.__CASHIPOP_DO_UPDATE()
        else window.location.reload()
      }} style={{
        background: T.brandGold, color: T.brand, border: 'none', borderRadius: 12,
        padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        Actualizar ahora
      </button>
    </div>
  )
}

// ─── Main App Router ─────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState('loading') // 'loading' | 'onboarding' | 'dashboard'
  const [profile, setProfile] = useState(null)
  const [toast, setToast] = useState('')
  const [showReset, setShowReset] = useState(false)

  const showToast = useCallback((msg, ms = 2500) => {
    setToast(msg)
    setTimeout(() => setToast(''), ms)
  }, [])

  // Check onboarding state on mount
  useEffect(() => {
    const onboarding = getOnboardingState()
    const profileConfig = getProfileConfig()

    if (onboarding?.completed && profileConfig) {
      setProfile(profileConfig)
      setAppState('dashboard')
    } else {
      setAppState('onboarding')
    }
  }, [])

  // Handle onboarding completion
  function handleOnboardingComplete(profileData) {
    setProfile(profileData)
    setAppState('dashboard')
    showToast('Configuracion completada')
  }

  // Reset to onboarding
  function handleReset() {
    clearOnboardingState()
    clearProfileConfig()
    setProfile(null)
    setAppState('onboarding')
    setShowReset(false)
    showToast('Configuracion reiniciada')
  }

  // Loading
  if (appState === 'loading') {
    return (
      <div style={{
        minHeight: '100svh', background: T.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: `linear-gradient(135deg, ${T.brand}, ${T.brandGold})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(94,64,91,0.2)',
          animation: 'pulse 1.5s ease infinite',
        }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-.03em' }}>C</span>
        </div>
        <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
      </div>
    )
  }

  // Onboarding
  if (appState === 'onboarding') {
    return (
      <>
        <UpdateBanner />
        <OnboardingRouter onComplete={handleOnboardingComplete} />
      </>
    )
  }

  // Dashboard (profile-adaptive)
  return (
    <>
      <UpdateBanner />
      {profile?.profileType === 'personal' ? (
        <PersonalDashboard
          profile={profile}
          onSettings={() => setShowReset(true)}
        />
      ) : (
        <BusinessDashboard
          profile={profile}
          onSettings={() => setShowReset(true)}
        />
      )}
      <Toast msg={toast} />
      {showReset && (
        <Confirm
          title="Reiniciar configuracion"
          msg="Esto borrara tu configuracion actual y volveras al inicio. Tus datos de gastos se mantendran."
          onYes={handleReset}
          onNo={() => setShowReset(false)}
          yesLabel="Reiniciar"
          yesColor={T.rose}
          icon={RotateCcw}
          iconColor={T.rose}
        />
      )}
    </>
  )
}
