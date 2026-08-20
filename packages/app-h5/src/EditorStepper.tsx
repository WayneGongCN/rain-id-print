import type { EditorStep } from './editor-types'

interface EditorStepperProps {
  currentStep: EditorStep
  maxUnlockedStep: number
  onChange: (step: EditorStep) => void
}

const STEPS: readonly { id: EditorStep; index: number; label: string; description: string }[] = [
  { id: 'process', index: 1, label: '照片处理', description: '上传与换底' },
  { id: 'crop', index: 2, label: '规格与裁切', description: '制作单张成片' },
  { id: 'layout', index: 3, label: '纸张排版', description: '生成冲印图' },
]

/** 展示向导步骤并限制用户进入尚未解锁的阶段，喵~ */
export function EditorStepper({ currentStep, maxUnlockedStep, onChange }: EditorStepperProps) {
  return (
    <nav className="editor-stepper" aria-label="照片制作步骤">
      <ol>
        {STEPS.map((step) => {
          const isCurrent = step.id === currentStep
          const isUnlocked = step.index <= maxUnlockedStep
          return (
            <li key={step.id} className={`${isCurrent ? 'is-current' : ''} ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}>
              <button
                type="button"
                disabled={!isUnlocked}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onChange(step.id)}
              >
                <b>{String(step.index).padStart(2, '0')}</b>
                <span><strong>{step.label}</strong><small>{step.description}</small></span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
