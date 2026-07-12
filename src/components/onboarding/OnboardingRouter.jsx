import { useState, useCallback } from 'react'
import ProfileSelect from './ProfileSelect'
import WelcomePersonal from './personal/WelcomePersonal'
import IncomeStep from './personal/IncomeStep'
import FixedExpensesStep from './personal/FixedExpensesStep'
import CategoriesStep from './personal/CategoriesStep'
import SuppliersStep from './business/SuppliersStep'
import MenuStep from './business/MenuStep'
import InventoryStep from './business/InventoryStep'
import { saveProfileConfig, saveOnboardingState } from '../../lib/storage'

// ─── Personal flow steps ─────────────────────────────────────────────────────
// welcome -> income -> fixedExpenses -> categories -> DONE
//
// ─── Business flow steps ─────────────────────────────────────────────────────
// suppliers -> menu -> inventory -> DONE

export default function OnboardingRouter({ onComplete }) {
  const [profileType, setProfileType] = useState(null) // null | 'personal' | 'business'
  const [step, setStep] = useState(-1) // -1 = welcome screen, 0+ = config steps
  const [data, setData] = useState({})

  const mergeData = useCallback((newData) => {
    const merged = { ...data, ...newData }
    setData(merged)
    return merged
  }, [data])

  // ── Profile selection ────────────────────────────────────────────────────
  if (!profileType) {
    return (
      <ProfileSelect onSelect={(type) => {
        setProfileType(type)
        setStep(type === 'personal' ? -1 : 0) // personal gets welcome, business goes direct
      }} />
    )
  }

  // ── Personal flow ────────────────────────────────────────────────────────
  if (profileType === 'personal') {
    // Welcome screen (blocks dashboard)
    if (step === -1) {
      return (
        <WelcomePersonal
          onStart={() => setStep(0)}
          onBack={() => { setProfileType(null); setStep(-1); setData({}) }}
        />
      )
    }

    // Step 1: Income
    if (step === 0) {
      return (
        <IncomeStep
          data={data}
          onBack={() => setStep(-1)}
          onNext={(stepData) => { mergeData(stepData); setStep(1) }}
        />
      )
    }

    // Step 2: Fixed expenses
    if (step === 1) {
      return (
        <FixedExpensesStep
          data={data}
          onBack={() => setStep(0)}
          onNext={(stepData) => { mergeData(stepData); setStep(2) }}
        />
      )
    }

    // Step 3: Variable categories
    if (step === 2) {
      return (
        <CategoriesStep
          data={data}
          onBack={() => setStep(1)}
          onFinish={(stepData) => {
            const finalData = {
              ...data, ...stepData,
              profileType: 'personal',
              completedAt: new Date().toISOString(),
            }
            saveProfileConfig(finalData)
            saveOnboardingState({ completed: true, profileType: 'personal' })
            onComplete(finalData)
          }}
        />
      )
    }
  }

  // ── Business flow ────────────────────────────────────────────────────────
  if (profileType === 'business') {
    if (step === 0) {
      return (
        <SuppliersStep
          data={data}
          onBack={() => { setProfileType(null); setStep(-1); setData({}) }}
          onNext={(stepData) => { mergeData(stepData); setStep(1) }}
        />
      )
    }

    if (step === 1) {
      return (
        <MenuStep
          data={data}
          onBack={() => setStep(0)}
          onNext={(stepData) => { mergeData(stepData); setStep(2) }}
        />
      )
    }

    if (step === 2) {
      return (
        <InventoryStep
          data={{ ...data }}
          onBack={() => setStep(1)}
          onFinish={(stepData) => {
            const finalData = {
              ...data, ...stepData,
              profileType: 'business',
              completedAt: new Date().toISOString(),
            }
            saveProfileConfig(finalData)
            saveOnboardingState({ completed: true, profileType: 'business' })
            onComplete(finalData)
          }}
        />
      )
    }
  }

  return null
}
