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
      <div class="mission">Переведите отряд на вертолётную площадку</div>
    </section>
    <footer class="controls" aria-label="Управление">
      <span><kbd>WASD</kbd> Камера</span>
      <span><kbd>Колесо</kbd> Зум</span>
      <span><kbd>ЛКМ</kbd> Клик или рамка</span>
      <span><kbd>ПКМ</kbd> Переместить</span>
    </footer>`
  const count = root.querySelector<HTMLElement>('#squad-count')!
  const pips = [...root.querySelectorAll('.pips i')]
  const mission = root.querySelector<HTMLElement>('.mission')!

  return {
    viewport: root.querySelector<HTMLElement>('.viewport')!,
    selectionBox: root.querySelector<HTMLElement>('.selection-box')!,
    selected(total: number) {
      count.textContent = 'Выбрано ' + total + ' / ' + pips.length
      pips.forEach((pip, index) => pip.classList.toggle('active', index < total))
    },
    arrived() {
      mission.textContent = 'Отряд на вертолётной площадке'
      mission.classList.add('complete')
    },
  }
}
