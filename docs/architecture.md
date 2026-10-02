# Архитектура frontend

## Поток зависимостей

```text
Vue views/components
        ↓
Pinia stores
        ↓
Repository interfaces
        ↓
Mock repositories → storage adapter → localStorage
        ↓
Seed data / taxonomy
```

Views отвечают за отображение и роутинг. Stores управляют асинхронным состоянием. Repository-контракты являются единственной точкой замены mock-данных на будущий Express API. Чистые функции поиска, категорий и географии находятся в domain-слое и ничего не знают о Vue.

## Маршруты

| URL                  | View                               |
| -------------------- | ---------------------------------- |
| `/`                  | каталог; фильтры находятся в query |
| `/listings/new`      | создание объявления                |
| `/listings/:id`      | объявление                         |
| `/listings/:id/edit` | редактирование своего объявления   |
| `/favorites`         | избранное                          |
| `/messages`          | список диалогов                    |
| `/messages/:chatId`  | выбранный диалог                   |
| `/profiles/me`       | профиль текущего пользователя      |
| `/profiles/:id`      | профиль продавца                   |

Старые `.html` URL обрабатываются redirect-маршрутами. В production сервер обязан возвращать `index.html` для всех frontend GET-маршрутов после обработки `/api` и статических файлов.

## Состояние и данные

- `listings` загружает каталог и выполняет CRUD через `ListingsRepository`.
- `session` содержит mock-пользователя `0`, продавцов и отзывы.
- `location` хранит выбранный город и радиус поиска от 10 до 300 км.
- `favorites`, `messages`, `searchHistory` изолируют пользовательскую активность.
- Query-параметры `q`, `category`, `min`, `max`, `condition`, `city`, `radius`, `sort` являются каноническим состоянием каталога.

Сохранены legacy-ключи `ryadom.*`. Mock-адаптер нормализует числовые ID, старые категории, старые структуры местоположения и точные координаты. Объявление содержит публичный адрес, а для расчёта расстояния используется только округлённая ячейка.

## Подключение Express

1. Реализовать HTTP-адаптеры интерфейсов из `src/services/repositories/contracts.ts`.
2. Выполнить DTO ↔ domain mapping внутри адаптера.
3. Переключить composition root в `src/services/repositories/index.ts`.
4. Не менять stores и views ради формата HTTP-ответа.
5. Загрузку реальных файлов оформить отдельным сервисом; текущие data URL предназначены только для mock-режима.

## UI и локализация

Tailwind CSS v4 подключён через Vite. Базовые design tokens определены в `src/styles/app.css`; перенесённые сложные layout/component правила сохраняют визуальный паритет прототипа. Фиксированный интерфейс использует `vue-i18n`; тексты объявлений и taxonomy считаются данными будущего API.
