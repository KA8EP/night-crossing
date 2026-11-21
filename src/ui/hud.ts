import type { Evacuation } from '../systems/evacuation'
import type { Outcome } from '../systems/combat'

export function createHud(root: HTMLElement) {
  root.innerHTML = `
    <header class="top">
      <div>
        <p class="overline"><span></span> SWAT / ТАКТИЧЕСКАЯ КАРТА</p>
        <h1>Ночной переход</h1>
      </div>
      <div class="squad" aria-live="polite">
        <div class="pips" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <span id="squad-count">0 / 4 в отряде</span>
        <span id="squad-alive">В строю 4 / 4</span>
      </div>
    </header>
    <section class="viewport" aria-label="Крыши небоскрёбов">
      <div class="selection-box" hidden></div>
      <div class="mission">Победите Пирокинетика или эвакуируйте всех гражданских через площадку H</div>
      <div class="boss-status"><span>Пирокинетик</span><meter id="boss-health" aria-label="Здоровье Пирокинетика" min="0" max="100" value="100"></meter></div>
    </section>
    <footer class="bottom">
      <section class="actions" aria-label="Тактические действия">
        <button type="button" id="build" aria-pressed="false">Баррикада</button>
        <button type="button" id="call">Вызвать вертолёт</button>
        <span id="flight-status" role="status">Вертолёт готов</span>
        <span id="score" aria-live="polite">Спасено 0 / 3 · Очки 0</span>
      </section>
      <div id="build-status" role="status" hidden></div>
      <div class="controls" aria-label="Управление">
        <span><kbd>WASD</kbd> Камера</span>
        <span><kbd>Колесо</kbd> Зум</span>
        <span><kbd>ЛКМ</kbd> Клик или рамка</span>
        <span><kbd>ПКМ</kbd> Переместить</span>
      </div>
    </footer>
    <dialog class="result" aria-labelledby="result-title" aria-describedby="result-description">
      <h2 id="result-title"></h2>
      <p id="result-description"></p>
      <button type="button" autofocus>Начать заново</button>
    </dialog>`
  const count = root.querySelector<HTMLElement>('#squad-count')!
  const pips = [...root.querySelectorAll('.pips i')]
  const mission = root.querySelector<HTMLElement>('.mission')!
  const build = root.querySelector<HTMLButtonElement>('#build')!
  const call = root.querySelector<HTMLButtonElement>('#call')!
  const flight = root.querySelector<HTMLElement>('#flight-status')!
  const score = root.querySelector<HTMLElement>('#score')!
  const buildStatus = root.querySelector<HTMLElement>('#build-status')!
  const viewport = root.querySelector<HTMLElement>('.viewport')!
  const bossHealth = root.querySelector<HTMLMeterElement>('#boss-health')!
  const squadAlive = root.querySelector<HTMLElement>('#squad-alive')!
  const result = root.querySelector<HTMLDialogElement>('.result')!
  const resultTitle = root.querySelector<HTMLElement>('#result-title')!
  const resultDescription = root.querySelector<HTMLElement>('#result-description')!
  result.addEventListener('cancel', event => event.preventDefault())
  result.querySelector('button')!.addEventListener('click', () => window.location.reload())
  const flightLabels = {
    ready: 'Вертолёт готов',
    incoming: 'Прибытие',
    hovering: 'Посадка гражданских',
    departing: 'Вертолёт улетает',
    cooldown: 'Следующий вызов через',
  }
  let lastStatus = ''

  return {
    viewport,
    selectionBox: root.querySelector<HTMLElement>('.selection-box')!,
    build,
    call,
    selected(total: number) {
      count.textContent = 'Выбрано ' + total + ' / ' + pips.length
      pips.forEach((pip, index) => pip.classList.toggle('active', index < total))
    },
    construction(active: boolean, message = '') {
      build.setAttribute('aria-pressed', String(active))
      viewport.classList.toggle('building', active)
      buildStatus.hidden = !message
      buildStatus.textContent = message
    },
    evacuation({ flight: phase, seconds, saved, total, available }: Evacuation['status']) {
      const status = phase + ':' + seconds + ':' + saved + ':' + available
      if (status === lastStatus) return
      lastStatus = status
      call.disabled = phase !== 'ready' || available === 0 || result.open
      flight.textContent = phase === 'ready' && saved === total
        ? 'Все гражданские спасены'
        : phase === 'ready' && available === 0 ? 'Некого эвакуировать' : flightLabels[phase] + (seconds ? ' · ' + seconds + ' с' : '')
      const losses = total - saved - available
      const points = 'Спасено ' + saved + ' / ' + total + ' · Очки ' + saved * 100 + (losses ? ' · Потери ' + losses : '')
      if (score.textContent !== points) score.textContent = points
      if (saved === total) {
        mission.textContent = 'Эвакуация завершена. Все гражданские спасены'
        mission.classList.add('complete')
      }
    },
    combat(healthPercent: number, living: number, total: number) {
      const percent = Math.ceil(healthPercent)
      if (bossHealth.value !== percent) bossHealth.value = percent
      const label = 'В строю ' + living + ' / ' + total
      if (squadAlive.textContent !== label) squadAlive.textContent = label
    },
    finish(outcome: Outcome, saved: number) {
      const won = outcome !== 'defeat'
      resultTitle.textContent = won ? 'Победа' : 'Поражение'
      const reason = {
        boss: 'Пирокинетик повержен.',
        evacuation: 'Все гражданские эвакуированы.',
        defeat: 'Весь отряд погиб.',
      }[outcome]
      resultDescription.textContent = reason + ' Очки спасения: ' + saved * 100 + '.'
      result.classList.toggle('defeat', !won)
      build.disabled = true
      call.disabled = true
      result.showModal()
    },
  }
}
