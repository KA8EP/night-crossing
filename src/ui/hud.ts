import { classes, type Soldier } from '../entities/soldier'
import type { AirSupport } from '../systems/air-support'
import type { Evacuation } from '../systems/evacuation'
import type { Outcome } from '../systems/combat'

export const actionInfo = {
  barricade: { label: 'Баррикада', icon: '▤', hint: 'Укажите точку на улице или крыше. Рядом с сапёром строительство быстрее.' },
  turret: { label: 'Турель', icon: '▰', hint: 'Укажите место на расстоянии до 8 м от сапёра.' },
  zip: { label: 'Зиплайн', icon: '╲', hint: 'Подведите сапёра к краю крыши. Щёлкните по улице в пределах 30 м.' },
  evac: { label: 'Эвакуация', icon: '✚', hint: 'Щёлкните по площадке H с зелёным дымом.' },
  strike: { label: 'Авиаудар', icon: '✦', hint: 'Укажите зону ракетного удара. Берегите укрытия в зоне попадания.' },
  assault: { label: 'Штурмовик', icon: classes.assault.icon, hint: 'Укажите свободную точку высадки штурмовика.' },
  sniper: { label: 'Снайпер', icon: classes.sniper.icon, hint: 'Укажите свободную точку высадки снайпера.' },
  engineer: { label: 'Сапёр', icon: classes.engineer.icon, hint: 'Укажите свободную точку высадки сапёра.' },
} as const
export type Action = keyof typeof actionInfo

const actionButton = (action: Action) => {
  const { label, icon } = actionInfo[action]
  return `<button type="button" data-action="${action}" aria-pressed="false"><span class="action-icon" aria-hidden="true">${icon}</span><span>${label}</span><small hidden></small></button>`
}

export function createHud(root: HTMLElement, select: (soldier: Soldier) => void) {
  root.innerHTML = `
    <header class="top">
      <div>
        <p class="overline">SWAT <span>/</span> ТАКТИЧЕСКАЯ ОПЕРАЦИЯ</p>
        <h1>Ночной переход</h1>
      </div>
      <div class="mission-totals">
        <div><span class="overline">СПАСЕНО</span><strong id="score" aria-live="polite">0 / 6</strong><small id="points">0 очков</small></div>
        <div><span class="overline">ВОЛН ВПЕРЕДИ</span><strong id="waves">3</strong></div>
      </div>
    </header>
    <section class="viewport" aria-label="Городской квартал">
      <div class="selection-box" hidden></div>
      <div class="mission"><span class="overline">ЦЕЛЬ ОПЕРАЦИИ</span>Победите Пирокинетика или эвакуируйте всех гражданских.</div>
      <div class="boss-status"><span>ПИРОКИНЕТИК</span><meter id="boss-health" aria-label="Здоровье Пирокинетика" min="0" max="100" value="100"></meter></div>
      <div class="notice" role="status" hidden></div>
    </section>
    <footer class="bottom">
      <div class="command-deck">
        <section class="squad-panel" aria-label="Отряд">
          <div class="panel-title"><span>ОТРЯД</span><span id="selected">Выбрано 0</span></div>
          <div class="members"></div>
        </section>
        <section class="build-panel" aria-label="Строительство и поддержка">
          <div class="panel-title"><span>ПОЛЕВЫЕ КОМАНДЫ</span></div>
          <div class="actions">${(['barricade', 'turret', 'zip', 'evac', 'strike'] as const).map(actionButton).join('')}</div>
        </section>
        <section class="drop-panel" aria-label="Состав подкрепления">
          <div class="panel-title"><span>ДЕСАНТ</span><span id="reserve">Резерв 6</span></div>
          <div class="actions">${(['assault', 'sniper', 'engineer'] as const).map(actionButton).join('')}</div>
        </section>
      </div>
      <div class="controls" aria-label="Управление">
        <span><kbd>WASD</kbd> Камера</span>
        <span><kbd>Q / E</kbd> Поворот</span>
        <span><kbd>Колесо</kbd> Зум</span>
        <span><kbd>ЛКМ</kbd> Выбрать</span>
        <span><kbd>ПКМ</kbd> Переместить</span>
        <span><kbd>Esc</kbd> Отмена</span>
      </div>
    </footer>
    <dialog class="result" aria-labelledby="result-title" aria-describedby="result-description">
      <h2 id="result-title"></h2>
      <p id="result-description"></p>
      <button type="button" autofocus>Начать заново</button>
    </dialog>`
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const viewport = get('.viewport')
  const notice = get('.notice')
  const selection = get('#selected')
  const waves = get('#waves')
  const score = get('#score')
  const points = get('#points')
  const bossHealth = get<HTMLMeterElement>('#boss-health')
  const reserve = get('#reserve')
  const members = get('.members')
  const result = get<HTMLDialogElement>('.result')
  const buttons = Object.fromEntries([...root.querySelectorAll<HTMLButtonElement>('[data-action]')]
    .map(button => [button.dataset.action, button])) as Record<Action, HTMLButtonElement>
  const portraits = new Map<Soldier, { button: HTMLButtonElement; meter: HTMLMeterElement }>()
  let selected: readonly Soldier[] = []

  result.addEventListener('cancel', event => event.preventDefault())
  result.querySelector('button')!.addEventListener('click', () => window.location.reload())

  function buttonState(action: Action, status: string, disabled: boolean) {
    const button = buttons[action]
    const badge = button.querySelector('small')!
    setText(badge, status)
    badge.hidden = !status
    button.disabled = disabled || result.open
  }

  return {
    viewport, buttons,
    selectionBox: get('.selection-box'),
    selected(soldiers: readonly Soldier[]) {
      selected = soldiers
      setText(selection, 'Выбрано ' + selected.length)
    },
    targeting(action: Action | undefined, message = '') {
      for (const key of Object.keys(buttons) as Action[]) buttons[key].setAttribute('aria-pressed', String(key === action))
      viewport.classList.toggle('building', Boolean(action))
      notice.hidden = !message
      setText(notice, message)
    },
    update(squad: readonly Soldier[], health: number, remaining: number, rescue: Evacuation['status'], air: AirSupport['status']) {
      setText(waves, String(remaining))
      setText(score, `${rescue.saved} / ${rescue.total}`)
      const losses = rescue.total - rescue.saved - rescue.available
      setText(points, rescue.saved * 100 + ' очк.' + (losses ? ' · Потери ' + losses : ''))
      bossHealth.value = Math.ceil(health)
      setText(reserve, 'Резерв ' + air.reserve)
      const flight = {
        ready: '', incoming: 'Подлёт', landed: 'Посадка', departing: 'Взлёт', cooldown: '',
      }[rescue.flight]
      const rescueStatus = rescue.flight === 'cooldown' ? `${rescue.seconds} с` : flight
      buttonState('evac', rescueStatus, rescue.flight !== 'ready' || rescue.available === 0)
      buttonState('strike', cooldown(air.strike, 'Заход'), air.strike !== 0)
      for (const role of ['assault', 'sniper', 'engineer'] as const) {
        buttonState(role, cooldown(air.drop, 'Высадка'), air.drop !== 0 || air.reserve === 0)
      }
      squad.forEach(soldier => {
        let portrait = portraits.get(soldier)
        if (!portrait) {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'portrait ' + soldier.role
          button.innerHTML = `<span aria-hidden="true">${soldier.stats.icon}</span><meter min="0" max="${soldier.stats.health}" aria-label="Здоровье"></meter>`
          button.addEventListener('click', () => select(soldier))
          portrait = { button, meter: button.querySelector('meter')! }
          portraits.set(soldier, portrait)
          members.append(button)
        }
        portrait.meter.value = soldier.health
        portrait.button.disabled = !soldier.ready
        portrait.button.setAttribute('aria-pressed', String(selected.includes(soldier)))
        const label = soldier.stats.label + ' · ' + (soldier.deploying ? 'На тросе' : `${Math.ceil(soldier.health)} HP`)
        portrait.button.title = label
        portrait.button.setAttribute('aria-label', label)
      })
    },
    finish(outcome: Outcome, saved: number) {
      get('#result-title').textContent = outcome === 'defeat' ? 'Поражение' : 'Победа'
      get('#result-description').textContent = {
        boss: 'Пирокинетик повержен.',
        evacuation: 'Все гражданские эвакуированы.',
        defeat: 'Весь отряд погиб.',
      }[outcome] + ' Очки спасения ' + saved * 100 + '.'
      result.classList.toggle('defeat', outcome === 'defeat')
      result.showModal()
    },
  }
}

function setText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text
}

function cooldown(seconds: number, active: string) {
  return seconds < 0 ? active : seconds > 0 ? seconds + ' с' : ''
}
