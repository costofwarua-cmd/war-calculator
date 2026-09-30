# Ціна війни / Cost of War

**Сайт:** https://costofwarukraine.com (домен у Cloudflare Registrar, DNS: CNAME `@` і `www` → costofwarua-cmd.github.io, DNS only) · репозиторій: https://github.com/costofwarua-cmd/war-calculator

Статичний двомовний (UA/EN) сайт: втрати росії та їхня орієнтовна вартість, збитки Україні, військові витрати сторін, допомога партнерів і калькулятор особистого внеску.

Збирання не потрібне: це чисті HTML, CSS і JS, без Node.

## Запуск локально

```bash
python -m http.server 8765
# відкрити http://localhost:8765
```

## Структура

| Шлях | Що це |
|---|---|
| `index.html` | увесь сайт на одній сторінці: заставка, 5 розділів, збори, співпраця |
| `methodology.html` | методологія й джерела |
| `assets/app.js` | спільна шапка/меню/футер (вставляються скриптом), інтро сторінок, логіка: живий лічильник, машина часу, графіки, калькулятор, картинка для соцмереж |
| `assets/fx.js` | анімоване небо в першому екрані, «стіна втрат» |
| `assets/globe.js` | 3D-глобус допомоги (d3-geo, `assets/vendor/`) |
| `assets/media/hero-video.*` | відеомонтаж для першого екрана (35 с, без звуку; автори — у `data/media.json`) |
| `data/fundraisers.json` | **збори** в блоці «Актуальні збори»; `demo: true` — приклади, замінити на справжні |
| `data/site.json` | контакти для «Співпраці» (email, Telegram) — **замінити заглушки** |
| `data/world.json` | карта світу для глобуса; **Крим перенесено до складу України** (`scripts/build_world.py`) |
| `assets/media/` | фото (webp) і відео прапора; автори та ліцензії — у `data/media.json` |
| `assets/i18n.js` | усі тексти UA/EN і назви країн |
| `assets/style.css` | стилі (кінематографічна темна тема) |
| `data/losses.json` | втрати рф, **оновлюється щодня автоматично** |
| `data/fx.json` | курс НБУ, **оновлюється щодня автоматично** |
| `data/history.json` | втрати за кожен день з 2022 року для машини часу; **дописується щодня автоматично** (`scripts/build_history.py` — повне перезавантаження) |
| `data/static.json` | вартість одиниць техніки, RDNA, ООН, SIPRI, ціни для калькулятора (оновлюється вручну) |
| `data/aid.json` | допомога партнерів, генерується з xlsx Kiel Institute |
| `scripts/update_data.py` | щоденне оновлення з перевірками коректності |
| `scripts/build_aid.py` | xlsx Kiel → `data/aid.json` |
| `.github/workflows/update-data.yml` | cron двічі на день |

Сторінка також намагається підтягнути свіжі втрати напряму з API. Якщо API недоступне, вона показує останній збережений знімок.

## Ручне оновлення даних

- **Kiel (допомога партнерів)** виходить кожні 1–2 місяці. Завантаж новий xlsx з <https://www.kielinstitut.de/publications/ukraine-support-tracker-data-6453/> у `data/raw/` і виконай:
  `python scripts/build_aid.py data/raw/<файл>.xlsx "Release NN" "YYYY-MM-DD"` (потрібен `pip install openpyxl`).
- **ООН (цивільні жертви)** публікує звіт щомісяця: <https://ukraine.ohchr.org/en/reports>. Онови `civilians` у `static.json`.
- **SIPRI** оновлюється раз на рік, у квітні. **RDNA** — раз на рік, у лютому.

## Деплой (Cloudflare Pages)

1. Створи репозиторій на GitHub і запуш код.
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git. Build command залиш порожнім, output directory — `/`.
3. У репозиторії: Settings → Actions → General → Workflow permissions → **Read and write** (потрібно, щоб бот комітив дані).
4. Підключи свій домен у Cloudflare Pages → Custom domains.

## Фото й відео

Усі медіа взято з Wikimedia Commons під вільними ліцензіями (CC BY 4.0 / CC BY-SA 4.0 / CC0). Коли додаєш нове фото, внеси автора й ліцензію в `data/media.json` і в підпис на сторінці. Без цього використовувати фото не можна.

## Реклама

План місць і правил — у `ADS.md` (поки не впроваджено).
