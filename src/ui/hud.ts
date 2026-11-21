import type { Evacuation } from '../systems/evacuation'

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
      </div>
    </header>
    <section class="viewport" aria-label="Крыши небоскрёбов">
      <div class="selection-box" hidden></div>
      <div class="mission">Подведите бойцов к гражданским и сопроводите их на площадку H</div>
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
    </footer>`
  const count = root.querySelector<HTMLElement>('#squad-count')!
  const pips = [...root.querySelectorAll('.pips i')]
  const mission = root.querySelector<HTMLElement>('.mission')!
  const build = root.querySelector<HTMLButtonElement>('#build')!
  const call = root.querySelector<HTMLButtonElement>('#call')!
  const flight = root.querySelector<HTMLElement>('#flight-status')!
  const score = root.querySelector<HTMLElement>('#score')!
  const buildStatus = root.querySelector<HTMLElement>('#build-status')!
  const viewport = root.querySelector<HTMLElement>('.viewport')!
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
    evacuation({ flight: phase, seconds, saved, total }: Evacuation['status']) {
      const status = phase + ':' + seconds + ':' + saved
      if (status === lastStatus) return
      lastStatus = status
      call.disabled = phase !== 'ready' || saved === total
      flight.textContent = phase === 'ready' && saved === total
        ? 'Все гражданские спасены'
        : flightLabels[phase] + (seconds ? ' · ' + seconds + ' с' : '')
      const points = 'Спасено ' + saved + ' / ' + total + ' · Очки ' + saved * 100
      if (score.textContent !== points) score.textContent = points
      if (saved === total) {
        mission.textContent = 'Эвакуация завершена. Все гражданские спасены'
        mission.classList.add('complete')
      }
    },
  }
}
