import { useState, useCallback } from 'react'
import ProfileSelect from './ProfileSelect'
import IncomeStep from './personal/IncomeStep'
import FixedExpensesStep from './personal/FixedExpensesStep'
import CategoriesStep from './personal/CategoriesStep'
import SuppliersStep from './business/SuppliersStep'
import MenuStep from './business/MenuStep'
import InventoryStep from './business/InventoryStep'
import { saveProfileConfig, saveOnboardingState } from '../../lib/storage'

export default function OnboardingRouter({ onComplete }) {
  const [profileType, setProfileType] = useState(null) // 'personal' | 'business'
  const [step, setStep] = useState(0)
  const [data, setData] = useState({})

  const mergeData = useCallback((newData) => {
    setData(prev => ({ ...prev, ...newData }))
    return { ...data, ...newData }
  }, [data])

  // Profile selection
  if (!profileType) {
    return <ProfileSelect onSelect={(type) => { setProfileType(type); setStep(0) }} />
  }

  // Personal flow: 3 steps
  if (profileType === 'personal') {
    switch (step) {
      case 0:
        return (
          <IncomeStep
            data={data}
            onBack={() => setProfileType(null)}
            onNext={(stepData) => { mergeData(stepData); setStep(1) }}
          />
        )
      case 1:
        return (
          <FixedExpensesStep
            data={data}
            onBack={() => setStep(0)}
            onNext={(stepData) => { mergeData(stepData); setStep(2) }}
          />
        )
      case 2:
        return (
          <CategoriesStep
            data={data}
            onBack={() => setStep(1)}
            onFinish={(stepData) => {
              const finalData = { ...data, ...stepData, profileType: 'personal', completedAt: new Date().toISOString() }
              saveProfileConfig(finalData)
              saveOnboardingState({ completed: true, profileType: 'personal' })
              onComplete(finalData)
            }}
          />
        )
      default:
        return null
    }
  }

  // Business flow: 3 steps
  if (profileType === 'business') {
    switch (step) {
      case 0:
        return (
          <SuppliersStep
            data={data}
            onBack={() => setProfileType(null)}
            onNext={(stepData) => { mergeData(stepData); setStep(1) }}
          />
        )
      case 1:
        return (
          <MenuStep
            data={data}
            onBack={() => setStep(0)}
            onNext={(stepData) => { mergeData(stepData); setStep(2) }}
          />
        )
      case 2:
        return (
          <InventoryStep
            data={{ ...data }}
            onBack={() => setStep(1)}
            onFinish={(stepData) => {
              const finalData = { ...data, ...stepData, profileType: 'business', completedAt: new Date().toISOString() }
              saveProfileConfig(finalData)
              saveOnboardingState({ completed: true, profileType: 'business' })
              onComplete(finalData)
            }}
          />
        )
      default:
        return null
    }
  }

  return null
}
