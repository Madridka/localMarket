// Marketplace taxonomy. Add a node to any `children` array to extend the tree;
// navigation, search and inherited attributes work at every depth.
const node = (id, name, children = [], extra = {}) => ({ id, name, slug: id, children, ...extra });

// Compact notation for sibling leaves: slug|name|comma-separated search aliases.
const leaves = (prefix, rows) => rows.trim().split('\n').map(row => {
  const [slug, name, aliases = ''] = row.trim().split('|');
  return node(`${prefix}${slug}`, name, [], aliases ? { searchAliases: aliases.split(',').map(alias => alias.trim()) } : {});
});

const field = (id, label, type = 'text', options) => ({ id, label, type, ...(options ? { options } : {}) });
const common = {
  brand: field('brand', 'Бренд'),
  model: field('model', 'Модель'),
  color: field('color', 'Цвет'),
  material: field('material', 'Материал'),
  quantity: field('quantity', 'Количество', 'number'),
  size: field('size', 'Размер'),
};

export const taxonomy = [
  node('electronics', 'Электроника', [
    node('phones', 'Телефоны и связь', [
      node('smartphones', 'Смартфоны', [], {
        searchAliases: ['телефон', 'айфон', 'iPhone', 'Android'],
        attributes: [common.brand, common.model, field('storage', 'Объём памяти', 'select', ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB']), common.color, field('batteryHealth', 'Состояние аккумулятора, %', 'number')],
      }),
      ...leaves('', `button-phones|Кнопочные телефоны
satellite-phones|Спутниковые телефоны
walkie-talkies|Рации
landline-phones|Стационарные телефоны
ip-phones|IP-телефоны`),
      node('phone-accessories', 'Аксессуары для телефонов', [
        ...leaves('phone-', `cases|Чехлы
screen-glass|Защитные стёкла
screen-films|Защитные плёнки
chargers|Зарядные устройства
cables|Кабели
power-banks|Внешние аккумуляторы|Power Bank,пауэрбанк
wireless-chargers|Беспроводные зарядки
car-holders|Автомобильные держатели
desk-holders|Настольные держатели
popsockets|Попсокеты
selfie-sticks|Селфи-палки
tripods|Штативы
sim-adapters|SIM-адаптеры
memory-cards|Карты памяти`),
        node('phone-spare-parts', 'Запчасти для телефонов', leaves('phone-part-', `batteries|Аккумуляторы
displays|Дисплеи
cases|Корпуса
cameras|Камеры
speakers|Динамики
microphones|Микрофоны
charging-ports|Разъёмы зарядки`)),
      ]),
    ], { searchAliases: ['мобильные телефоны', 'связь'] }),
    node('computers', 'Компьютеры', [
      ...leaves('', `desktop-computers|Настольные компьютеры
gaming-computers|Игровые компьютеры
all-in-one-computers|Моноблоки
mini-pcs|Мини-ПК
servers|Серверы
workstations|Рабочие станции
laptops|Ноутбуки
ultrabooks|Ультрабуки
netbooks|Нетбуки`),
      node('computer-components', 'Комплектующие', [
        node('processors', 'Процессоры', leaves('processor-', `intel|Intel
amd|AMD`), {
          searchAliases: ['CPU', 'ЦПУ'],
          attributes: [common.brand, common.model, field('socket', 'Сокет', 'select', ['AM4', 'AM5', 'LGA 1151', 'LGA 1200', 'LGA 1700', 'LGA 1851', 'Другой']), field('cores', 'Количество ядер', 'number')],
        }),
        node('motherboards', 'Материнские платы', leaves('motherboard-', `intel|Intel socket
amd|AMD socket`), {
          searchAliases: ['материнка'], attributes: [common.brand, common.model, field('socket', 'Сокет'), field('formFactor', 'Форм-фактор', 'select', ['ATX', 'Micro-ATX', 'Mini-ITX', 'Другой'])],
        }),
        node('video-cards', 'Видеокарты', leaves('video-card-', `nvidia|NVIDIA
amd|AMD
intel|Intel`), {
          searchAliases: ['GPU', 'графическая карта', 'видюха'], attributes: [field('gpuBrand', 'Производитель GPU', 'select', ['NVIDIA', 'AMD', 'Intel', 'Другой']), common.model, field('videoMemory', 'Объём видеопамяти', 'select', ['2 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '24 GB', 'Другое']), field('cardBrand', 'Производитель карты')],
        }),
        node('ram', 'Оперативная память', leaves('ram-', `ddr3|DDR3
ddr4|DDR4
ddr5|DDR5
sodimm|SO-DIMM`), {
          searchAliases: ['RAM', 'DDR', 'ОЗУ', 'оперативка'], attributes: [field('ramType', 'Тип памяти', 'select', ['DDR3', 'DDR4', 'DDR5', 'SO-DIMM']), field('capacity', 'Объём', 'select', ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB', 'Другое']), field('frequency', 'Частота, МГц', 'number'), field('moduleCount', 'Количество модулей', 'number')],
        }),
        node('storage-drives', 'Накопители', leaves('storage-', `hdd|Жёсткие диски HDD
ssd-sata|SSD SATA
ssd-m2|SSD M.2
nvme|NVMe
external|Внешние диски
flash|USB-флешки`), { attributes: [common.brand, field('capacity', 'Объём памяти')] }),
        ...leaves('computer-', `power-supplies|Блоки питания
cases|Корпуса
sound-cards|Звуковые карты
network-cards|Сетевые карты
wifi-adapters|Wi-Fi адаптеры
controllers|Контроллеры
expansion-cards|Платы расширения
optical-drives|Оптические приводы
cables-adapters|Кабели и переходники`),
        node('computer-cooling', 'Системы охлаждения', leaves('cooling-', `cpu-coolers|Кулеры CPU
case-fans|Корпусные вентиляторы
liquid|Жидкостное охлаждение|СЖО
thermal-paste|Термопаста`)),
      ]),
      node('computer-peripherals', 'Периферия', [
        node('monitors', 'Мониторы', [], { attributes: [common.brand, common.model, field('diagonal', 'Диагональ, дюймы', 'number'), field('resolution', 'Разрешение')] }),
        node('keyboards', 'Клавиатуры', leaves('keyboard-', `mechanical|Механические
membrane|Мембранные
wireless|Беспроводные`)),
        ...leaves('peripheral-', `mice|Мыши
mouse-pads|Коврики для мыши
webcams|Веб-камеры
microphones|Микрофоны
headphones|Наушники
headsets|Гарнитуры
speakers|Колонки
printers|Принтеры
mfp|МФУ
scanners|Сканеры
graphics-tablets|Графические планшеты
ups|Источники бесперебойного питания|UPS
usb-hubs|USB-хабы
docking-stations|Док-станции
cables-adapters|Кабели и адаптеры`),
      ]),
      node('network-equipment', 'Сетевое оборудование', leaves('network-', `routers|Роутеры
modems|Модемы
switches|Коммутаторы
access-points|Точки доступа
nas|Сетевые хранилища|NAS
repeaters|Репитеры`)),
    ]),
    node('tablets-ebooks', 'Планшеты и электронные книги', [
      ...leaves('', `tablets|Планшеты
ebooks|Электронные книги
pen-tablets|Графические планшеты`),
      node('tablet-accessories', 'Аксессуары', leaves('tablet-', `cases|Чехлы
styluses|Стилусы
keyboards|Клавиатуры
chargers|Зарядные устройства
screen-protectors|Защитные стёкла и плёнки`)),
    ]),
    node('tv-video', 'Телевизоры и видео', [
      ...leaves('video-', `tvs|Телевизоры
projectors|Проекторы
projection-screens|Проекционные экраны
media-players|Медиаплееры
tv-boxes|ТВ-приставки
android-tv|Android TV
apple-tv|Apple TV
blu-ray|Blu-ray плееры
dvd-players|DVD-плееры
antennas|Антенны
receivers|Ресиверы
brackets|Кронштейны
remotes|Пульты
hdmi-equipment|HDMI-оборудование`),
    ]),
    node('audio', 'Аудио', [
      node('headphones', 'Наушники', leaves('', `tws-headphones|TWS-наушники
over-ear-headphones|Полноразмерные наушники
wired-headphones|Проводные наушники
in-ear-headphones|Внутриканальные наушники`)),
      ...leaves('audio-', `speakers|Колонки
bluetooth-speakers|Bluetooth-колонки
soundbars|Саундбары
home-theaters|Домашние кинотеатры
amplifiers|Усилители
receivers|Ресиверы
dacs|Цифро-аналоговые преобразователи|ЦАП
turntables|Виниловые проигрыватели
boomboxes|Магнитолы
music-centers|Музыкальные центры
microphones|Микрофоны
studio-equipment|Студийное оборудование`),
    ]),
    node('photo-video', 'Фото и видео', [
      node('cameras', 'Фотоаппараты', leaves('', `dslr-cameras|Зеркальные фотоаппараты
mirrorless-cameras|Беззеркальные фотоаппараты
compact-cameras|Компактные фотоаппараты
film-cameras|Плёночные фотоаппараты`)),
      ...leaves('photo-', `lenses|Объективы
camcorders|Видеокамеры
action-cameras|Экшн-камеры
drones|Дроны
stabilizers|Стабилизаторы
tripods|Штативы
flashes|Вспышки
lighting|Освещение
backdrops|Фотофоны
memory-cards|Карты памяти
filters|Фильтры
batteries|Аккумуляторы
bags|Сумки
backpacks|Рюкзаки`),
    ]),
    node('gaming', 'Игры и консоли', [
      node('consoles', 'Игровые приставки', leaves('', `playstation|PlayStation
xbox|Xbox
nintendo|Nintendo
retro-consoles|Ретро-приставки
other-consoles|Другие приставки`)),
      ...leaves('gaming-', `games|Игры
controllers|Геймпады
steering-wheels|Рули
pedals|Педали
joysticks|Джойстики
vr-headsets|VR-шлемы
accessories|Аксессуары`),
    ]),
    node('smart-home', 'Умный дом', leaves('smart-', `speakers|Умные колонки
lamps|Умные лампы
plugs|Умные розетки
sensors|Датчики
cameras|Камеры наблюдения
doorbells|Видеодомофоны
locks|Умные замки
thermostats|Термостаты
hubs|Хабы
robots|Роботы
security-systems|Охранные системы`)),
  ]),
  node('home', 'Дом', [
    node('kitchen', 'Кухня', [
      node('kitchen-furniture', 'Мебель', [
        ...leaves('kitchen-', `sets|Кухонные гарнитуры
corners|Кухонные уголки
buffets|Буфеты
cabinets|Шкафы
shelves|Полки
bar-counters|Барные стойки`),
        node('kitchen-tables', 'Столы', leaves('kitchen-table-', `dining|Обеденные столы
folding|Раскладные столы
bar|Барные столы
standard|Кухонные столы`)),
        node('kitchen-chairs-group', 'Стулья', [
          node('kitchen-chairs', 'Кухонные стулья'),
          ...leaves('kitchen-chair-', `dining|Обеденные стулья
bar|Барные стулья
stools|Табуреты`),
        ], { attributes: [common.material, common.color, field('chairType', 'Тип стула', 'select', ['Кухонный', 'Обеденный', 'Барный', 'Табурет', 'Другой']), common.quantity] }),
      ]),
      node('kitchen-dishes', 'Посуда', [
        ...leaves('dish-', `plates|Тарелки
mugs|Кружки
glasses|Стаканы
wine-glasses|Бокалы
shot-glasses|Рюмки
sets|Сервизы
bowls|Миски
salad-bowls|Салатники
pots|Кастрюли
pans|Сковороды
cauldrons|Казаны
saute-pans|Сотейники
kettles|Чайники
thermoses|Термосы
containers|Контейнеры
baking-dishes|Формы для выпечки
baking-trays|Противни
cutlery|Столовые приборы`),
        node('dish-cups', 'Чашки', leaves('cup-', `tea|Чайные чашки
coffee|Кофейные чашки
espresso|Эспрессо-чашки`)),
      ]),
      node('kitchen-utensils', 'Кухонные принадлежности', leaves('utensil-', `knives|Ножи
cutting-boards|Разделочные доски
spatulas|Лопатки
ladles|Половники
whisks|Венчики
graters|Тёрки
openers|Открывалки
corkscrews|Штопоры
scissors|Ножницы
colanders|Дуршлаги
sieves|Сита
measuring-cups|Мерные ёмкости
mills|Мельницы
spice-sets|Наборы специй
holders|Подставки`)),
      node('kitchen-storage', 'Хранение', leaves('kitchen-storage-', `food-containers|Контейнеры для еды
spice-jars|Банки для специй
organizers|Органайзеры
baskets|Корзины
racks|Полки и рейлинги`)),
      node('kitchen-textiles', 'Текстиль', leaves('kitchen-textile-', `tablecloths|Скатерти
towels|Полотенца
aprons|Фартуки
napkins|Салфетки
pot-holders|Прихватки`)),
      node('kitchen-decor', 'Декор', leaves('kitchen-decor-', `vases|Вазы
clocks|Часы
wall-decor|Настенный декор`)),
      node('kitchen-appliances', 'Кухонная техника', leaves('kitchen-appliance-', `coffee-machines|Кофемашины
microwaves|Микроволновки
blenders|Блендеры
multicookers|Мультиварки
food-processors|Кухонные комбайны`)),
    ]),
    node('bedroom', 'Спальня', [
      node('beds', 'Кровати', leaves('bed-', `single|Односпальные кровати
double|Двуспальные кровати
child|Детские кровати
bunk|Двухъярусные кровати
sofa|Диван-кровати`)),
      ...leaves('bedroom-', `mattresses|Матрасы
bed-bases|Основания для кроватей
nightstands|Тумбочки
chests|Комоды
wardrobes|Шкафы
dressing-tables|Туалетные столики
ottomans|Пуфы
mirrors|Зеркала
bedding|Постельное бельё
pillows|Подушки
blankets|Одеяла
throws|Пледы
bedspreads|Покрывала`),
    ]),
    node('living-room', 'Гостиная', [
      node('sofas', 'Диваны', leaves('sofa-', `straight|Прямые диваны
corner|Угловые диваны
modular|Модульные диваны
bed|Диван-кровати`)),
      ...leaves('living-', `armchairs|Кресла
ottomans|Пуфы
coffee-tables|Журнальные столы
tv-stands|ТВ-тумбы
wall-units|Стенки
wardrobes|Шкафы
shelving|Стеллажи
shelves|Полки
display-cabinets|Витрины`),
    ]),
    node('bathroom', 'Ванная и туалет', [
      node('bathroom-plumbing', 'Сантехника', leaves('bathroom-plumbing-', `bathtubs|Ванны
shower-cabins|Душевые кабины
shower-trays|Душевые поддоны
sinks|Раковины
toilets|Унитазы
bidets|Биде
installations|Инсталляции
faucets|Смесители
shower-systems|Душевые системы
shower-heads|Лейки
hoses|Шланги
siphons|Сифоны`)),
      node('bathroom-furniture', 'Мебель', leaves('bathroom-furniture-', `sink-cabinets|Тумбы под раковину
cabinets|Шкафчики
wall-cabinets|Навесные шкафы
tall-cabinets|Пеналы
shelves|Полки
mirror-cabinets|Зеркальные шкафы`)),
      node('bathroom-accessories', 'Аксессуары', [
        node('bathroom-holders', 'Держатели', [
          node('bathroom-toilet-paper-holders', 'Держатели туалетной бумаги', [], { searchAliases: ['держатель для туалетной бумаги'] }),
          ...leaves('bathroom-holder-', `towels|Держатели полотенец
toothbrushes|Держатели зубных щёток
soap|Мыльницы с держателем`),
        ]),
        ...leaves('bathroom-accessory-', `hooks|Крючки
soap-dishes|Мыльницы
dispensers|Дозаторы
cups|Стаканы
toilet-brushes|Ёршики
laundry-baskets|Корзины для белья
mats|Коврики
shower-curtains|Шторки
curtain-rods|Карнизы
shower-shelves|Полки для душа
organizers|Органайзеры
stands|Подставки`),
      ]),
    ]),
    node('hallway', 'Прихожая', leaves('hallway-', `wardrobes|Шкафы
sets|Прихожие
shoe-racks|Обувницы
coat-racks|Вешалки
shelves|Полки
benches|Банкетки
ottomans|Пуфы
mirrors|Зеркала
key-holders|Ключницы
mats|Коврики`)),
    node('home-office', 'Кабинет', leaves('home-office-', `writing-desks|Письменные столы
computer-desks|Компьютерные столы
office-chairs|Офисные кресла
gaming-chairs|Компьютерные кресла
chairs|Стулья
shelving|Стеллажи
bookcases|Книжные шкафы
shelves|Полки
drawers|Тумбы`)),
    node('lighting', 'Освещение', leaves('lighting-', `chandeliers|Люстры
ceiling-lights|Потолочные светильники
wall-lights|Настенные светильники
sconces|Бра
floor-lamps|Торшеры
desk-lamps|Настольные лампы
night-lights|Ночники
led-strips|LED-ленты
outdoor-lights|Уличные светильники
light-bulbs|Лампочки
lampshades|Абажуры`)),
    node('home-decor', 'Декор', leaves('decor-', `paintings|Картины
posters|Постеры
photo-frames|Фоторамки
vases|Вазы
candles|Свечи
candle-holders|Подсвечники
clocks|Часы
mirrors|Зеркала
figurines|Статуэтки
artificial-plants|Искусственные растения
baskets|Корзины
planters|Кашпо
wall-panels|Панно`)),
    node('home-textiles', 'Текстиль', leaves('textile-', `curtains|Шторы
tulle|Тюль
curtain-rods|Карнизы
carpets|Ковры
rugs|Коврики
throws|Пледы
bedspreads|Покрывала
pillows|Подушки
covers|Чехлы
tablecloths|Скатерти
towels|Полотенца`)),
    node('home-storage', 'Хранение и организация', leaves('home-storage-', `shelves|Полки
boxes|Коробки
baskets|Корзины
organizers|Органайзеры
clothes-racks|Стойки для одежды
shoe-organizers|Хранение обуви`)),
  ]),
  node('appliances', 'Бытовая техника', [
    node('large-appliances', 'Крупная техника', leaves('appliance-', `refrigerators|Холодильники
freezers|Морозильники
washing-machines|Стиральные машины
dryers|Сушильные машины
dishwashers|Посудомоечные машины
stoves|Плиты
ovens|Духовые шкафы
cooktops|Варочные панели
range-hoods|Вытяжки`)),
    node('small-kitchen-appliances', 'Мелкая кухонная техника', leaves('appliance-', `microwaves|Микроволновки
kettles|Чайники
coffee-machines|Кофемашины
coffee-makers|Кофеварки
coffee-grinders|Кофемолки
blenders|Блендеры
mixers|Миксеры
meat-grinders|Мясорубки
toasters|Тостеры
multicookers|Мультиварки
air-fryers|Аэрогрили
juicers|Соковыжималки
bread-makers|Хлебопечки
waffle-makers|Вафельницы
electric-grills|Электрогрили
kitchen-scales|Кухонные весы
food-processors|Кухонные комбайны`)),
    node('cleaning-appliances', 'Техника для уборки', leaves('', `vacuum-cleaners|Пылесосы
robot-vacuums|Роботы-пылесосы
upright-vacuums|Вертикальные пылесосы
steam-cleaners|Пароочистители
wet-vacuums|Моющие пылесосы
window-cleaners|Стеклоочистители
carpet-cleaners|Ковромоечные машины`)),
    node('climate-appliances', 'Климатическая техника', leaves('climate-', `air-conditioners|Кондиционеры
fans|Вентиляторы
heaters|Обогреватели
convectors|Конвекторы
fan-heaters|Тепловентиляторы
humidifiers|Увлажнители
air-purifiers|Очистители воздуха
dehumidifiers|Осушители
air-washers|Мойки воздуха`)),
    node('personal-appliances', 'Техника для ухода', leaves('appliance-', `irons|Утюги
steamers|Отпариватели
sewing-machines|Швейные машины
hair-dryers|Фены
hair-stylers|Стайлеры
curling-irons|Плойки
electric-shavers|Электробритвы
hair-clippers|Машинки для стрижки
epilators|Эпиляторы
electric-toothbrushes|Электрические зубные щётки`)),
  ]),
  node('clothing', 'Одежда и обувь', [
    ...['men', 'women', 'children'].map((audience, index) => {
      const title = ['Мужское', 'Женское', 'Детское'][index];
      return node(audience, title, [
        node(`${audience}-clothes`, 'Одежда', [
          node(`${audience}-outerwear`, 'Верхняя одежда', leaves(`${audience}-`, `jackets|Куртки
coats|Пальто
down-jackets|Пуховики
windbreakers|Ветровки
raincoats|Плащи
vests|Жилеты`)),
          ...leaves(`${audience}-`, `sweatshirts|Толстовки
hoodies|Худи
sweaters|Свитеры
cardigans|Кардиганы
shirts|Рубашки
t-shirts|Футболки
tank-tops|Майки
pants|Брюки
jeans|Джинсы
shorts|Шорты
suits|Костюмы
homewear|Домашняя одежда
underwear|Нижнее бельё
socks|Носки`),
          ...(audience === 'women' ? leaves('women-', `dresses|Платья
skirts|Юбки
blouses|Блузки
leggings|Легинсы`) : []),
        ], { attributes: [common.size, common.brand, common.color, common.material] }),
        node(`${audience}-shoes`, 'Обувь', leaves(`${audience}-`, `sneakers|Кроссовки
canvas-shoes|Кеды
boots|Ботинки
dress-shoes|Туфли
high-boots|Сапоги
sandals|Сандалии
slippers|Тапочки
rain-boots|Резиновая обувь`), { attributes: [field('shoeSize', 'Размер обуви'), common.brand, common.color, common.material] }),
        node(`${audience}-accessories`, 'Аксессуары', leaves(`${audience}-`, `bags|Сумки
backpacks|Рюкзаки
wallets|Кошельки
belts|Ремни
hats|Головные уборы
scarves|Шарфы
gloves|Перчатки
glasses|Очки
watches|Часы
jewelry|Украшения`)),
      ]);
    }),
    node('unisex-accessories', 'Универсальные аксессуары', leaves('unisex-', `backpacks|Рюкзаки
bags|Сумки
wallets|Кошельки
watches|Часы
glasses|Очки`)),
  ]),
  node('kids', 'Детское', [
    node('kids-clothing', 'Одежда', leaves('kids-clothing-', `outerwear|Верхняя одежда
shirts|Футболки и рубашки
pants|Брюки и джинсы
dresses|Платья
sets|Комплекты
newborn|Для новорождённых`), { attributes: [common.size, common.brand, common.color, common.material] }),
    node('kids-shoes', 'Обувь', leaves('kids-shoes-', `sneakers|Кроссовки
boots|Ботинки
sandals|Сандалии
rain-boots|Резиновые сапоги
slippers|Тапочки`)),
    node('kids-toys', 'Игрушки', leaves('kids-', `construction-toys|Конструкторы
dolls|Куклы
toy-cars|Машинки
soft-toys|Мягкие игрушки
board-games|Настольные игры
educational-toys|Развивающие игрушки
puzzles|Пазлы
remote-control-toys|Радиоуправляемые игрушки
toy-weapons|Игрушечное оружие
musical-toys|Музыкальные игрушки
ride-on-toys|Каталки
scooters|Самокаты`)),
    node('kids-strollers', 'Коляски', leaves('stroller-', `prams|Люльки
walking|Прогулочные коляски
transformers|Коляски-трансформеры
double|Коляски для двойни
accessories|Аксессуары для колясок`)),
    node('kids-car-seats', 'Автокресла', leaves('car-seat-', `infant|Автолюльки
child|Детские автокресла
boosters|Бустеры`)),
    node('kids-furniture', 'Детская мебель', leaves('kids-furniture-', `cribs|Детские кроватки
beds|Кровати
high-chairs|Стульчики для кормления
desks|Столы и парты
chairs|Стулья
wardrobes|Шкафы
drawers|Комоды`)),
    node('kids-feeding', 'Кормление', leaves('feeding-', `bottles|Бутылочки
sterilizers|Стерилизаторы
breast-pumps|Молокоотсосы
high-chairs|Стульчики для кормления
dishes|Детская посуда`)),
    node('kids-care', 'Уход', leaves('kids-care-', `diapers|Подгузники
changing-tables|Пеленальные столики
care-products|Средства ухода
baby-monitors|Радионяни`)),
    node('kids-bathing', 'Купание', leaves('kids-bathing-', `bathtubs|Ванночки
seats|Сиденья для купания
towels|Полотенца
toys|Игрушки для купания`)),
    node('kids-safety', 'Безопасность', leaves('kids-safety-', `gates|Защитные ворота
locks|Блокираторы
corner-guards|Защита углов
monitors|Видеоняни`)),
    node('kids-school', 'Школа', leaves('school-', `backpacks|Рюкзаки
pencil-cases|Пеналы
stationery|Канцелярия
textbooks|Учебники
uniforms|Форма
desks|Столы
chairs|Стулья`)),
  ]),
  node('auto', 'Авто и мото', [
    node('cars', 'Автомобили', leaves('car-', `passenger|Легковые автомобили
suv|Внедорожники
commercial|Коммерческий транспорт
trucks|Грузовые автомобили
electric|Электромобили`), { attributes: [common.brand, common.model, field('year', 'Год выпуска', 'number'), field('mileage', 'Пробег, км', 'number')] }),
    node('auto-parts', 'Запчасти', [
      node('engine-parts', 'Двигатель', leaves('engine-', `engines|Двигатели
cylinder-heads|ГБЦ
blocks|Блоки цилиндров
pistons|Поршни
crankshafts|Коленвалы
camshafts|Распредвалы
turbos|Турбины
starters|Стартеры
alternators|Генераторы
spark-plugs|Свечи
ignition-coils|Катушки зажигания
filters|Фильтры`)),
      node('transmission-parts', 'Трансмиссия', leaves('transmission-', `gearboxes|Коробки передач
clutches|Сцепления
driveshafts|Приводные валы
differentials|Дифференциалы`)),
      node('suspension-parts', 'Подвеска', leaves('suspension-', `shock-absorbers|Амортизаторы
springs|Пружины
control-arms|Рычаги
bushings|Сайлентблоки
wheel-bearings|Ступичные подшипники`)),
      node('brake-parts', 'Тормоза', leaves('brake-', `discs|Тормозные диски
pads|Колодки
calipers|Суппорты
hoses|Тормозные шланги`)),
      node('steering-parts', 'Рулевое управление', leaves('steering-', `racks|Рулевые рейки
rods|Тяги
power-steering|Гидроусилители`)),
      node('body-parts', 'Кузов', leaves('body-', `bumpers|Бамперы
doors|Двери
hoods|Капоты
fenders|Крылья
mirrors|Зеркала`)),
      node('car-lighting', 'Оптика', leaves('car-light-', `headlights|Фары
tail-lights|Фонари
fog-lights|Противотуманные фары
bulbs|Автолампы`)),
      node('car-electrical', 'Электрика', leaves('car-electric-', `batteries|Аккумуляторы
wiring|Проводка
sensors|Датчики
control-units|Блоки управления`)),
      ...leaves('auto-part-', `cooling|Система охлаждения
exhaust|Выхлоп
fuel-system|Топливная система
interior|Салон
glass|Стёкла`),
    ], { attributes: [common.brand, common.model, field('carMake', 'Марка автомобиля'), field('carModel', 'Модель автомобиля')] }),
    node('auto-wheels', 'Колёса', [
      node('auto-tires', 'Шины', [], { attributes: [field('tireWidth', 'Ширина, мм'), field('tireProfile', 'Профиль'), field('rimDiameter', 'Диаметр, дюймы'), field('season', 'Сезон', 'select', ['Лето', 'Зима', 'Всесезонные'])] }),
      ...leaves('wheel-', `rims|Диски
sets|Комплекты колёс
hubcaps|Колпаки
bolts|Болты
nuts|Гайки`),
    ]),
    node('auto-accessories', 'Аксессуары', leaves('auto-accessory-', `mats|Коврики
seat-covers|Чехлы
phone-holders|Держатели телефона
dashcams|Видеорегистраторы
radar-detectors|Радар-детекторы
head-units|Автомагнитолы
speakers|Акустика
compressors|Компрессоры
jacks|Домкраты
tools|Инструменты
organizers|Органайзеры
roof-racks|Багажники
roof-boxes|Автобоксы
chargers|Зарядные устройства`)),
    node('motorcycles', 'Мото', leaves('moto-', `motorcycles|Мотоциклы
scooters|Скутеры
mopeds|Мопеды
atvs|Квадроциклы
gear|Экипировка
helmets|Шлемы
parts|Запчасти
accessories|Аксессуары`)),
  ]),
  node('sports', 'Спорт и отдых', [
    node('fitness', 'Фитнес', leaves('fitness-', `dumbbells|Гантели
barbells|Штанги
weights|Блины и гири
exercise-machines|Тренажёры
exercise-bikes|Велотренажёры
treadmills|Беговые дорожки
yoga-mats|Коврики для йоги
resistance-bands|Эспандеры
jump-ropes|Скакалки
fitness-trackers|Фитнес-браслеты`)),
    node('running', 'Бег', leaves('running-', `shoes|Беговые кроссовки
clothing|Беговая одежда
watches|Спортивные часы
accessories|Аксессуары`)),
    node('football', 'Футбол', leaves('football-', `balls|Мячи
boots|Бутсы
uniforms|Форма
goalkeeper-gloves|Вратарские перчатки
shin-guards|Щитки
goals|Ворота
accessories|Аксессуары`)),
    node('hockey', 'Хоккей', leaves('hockey-', `skates|Коньки
sticks|Клюшки
helmets|Шлемы
protective-gear|Защита
pucks|Шайбы
uniforms|Форма`)),
    node('basketball', 'Баскетбол', leaves('basketball-', `balls|Мячи
shoes|Обувь
uniforms|Форма
hoops|Кольца`)),
    node('volleyball', 'Волейбол', leaves('volleyball-', `balls|Мячи
nets|Сетки
shoes|Обувь
uniforms|Форма`)),
    node('tennis', 'Теннис', leaves('tennis-', `rackets|Ракетки
balls|Мячи
shoes|Обувь
bags|Сумки
strings|Струны`)),
    node('badminton', 'Бадминтон', leaves('badminton-', `rackets|Ракетки
shuttlecocks|Воланы
nets|Сетки`)),
    node('martial-arts', 'Единоборства', leaves('martial-', `gloves|Перчатки
protective-gear|Защита
uniforms|Форма
punching-bags|Груши
mats|Маты`)),
    node('skiing', 'Лыжи', leaves('ski-', `skis|Лыжи
boots|Ботинки
poles|Палки
bindings|Крепления
clothing|Одежда`)),
    node('snowboarding', 'Сноуборд', leaves('snowboard-', `boards|Сноуборды
boots|Ботинки
bindings|Крепления
helmets|Шлемы
clothing|Одежда`)),
    node('skating', 'Коньки', leaves('skating-', `figure|Фигурные коньки
hockey|Хоккейные коньки
roller|Роликовые коньки`)),
    node('cycling', 'Велоспорт', [
      node('bicycles', 'Велосипеды', leaves('', `mountain-bikes|Горные велосипеды
city-bikes|Городские велосипеды
road-bikes|Шоссейные велосипеды
bmx-bikes|BMX
kids-bikes|Детские велосипеды
electric-bikes|Электровелосипеды
folding-bikes|Складные велосипеды`)),
      ...leaves('cycling-', `parts|Запчасти
helmets|Шлемы
lights|Фонари
locks|Замки
pumps|Насосы
bags|Сумки
fenders|Крылья
computers|Велокомпьютеры`),
    ]),
    node('swimming', 'Плавание', leaves('swim-', `swimsuits|Купальники и плавки
goggles|Очки
caps|Шапочки
fins|Ласты
training-gear|Инвентарь`)),
    node('camping', 'Туризм', leaves('camping-', `tents|Палатки
sleeping-bags|Спальные мешки
backpacks|Рюкзаки
camping-stoves|Горелки
lanterns|Фонари
camping-furniture|Походная мебель
navigation|Навигация`)),
    node('fishing', 'Рыбалка', leaves('fishing-', `rods|Удочки
spinning-rods|Спиннинги
reels|Катушки
lures|Приманки
lines|Леска
boats|Лодки
clothing|Одежда`)),
    node('hunting', 'Охота', leaves('hunting-', `clothing|Одежда
optics|Оптика
decoys|Манки
accessories|Аксессуары`)),
    node('water-sports', 'Водный спорт', leaves('water-sport-', `sup-boards|SUP-доски
kayaks|Каяки
canoes|Каноэ
life-jackets|Спасательные жилеты
diving-gear|Снаряжение для дайвинга`)),
  ]),
  node('hobby', 'Хобби и развлечения', [
    node('music-instruments', 'Музыкальные инструменты', [
      node('guitars', 'Гитары', leaves('', `electric-guitars|Электрогитары
acoustic-guitars|Акустические гитары
classical-guitars|Классические гитары
bass-guitars|Бас-гитары`)),
      ...leaves('music-', `keyboards|Клавишные
drums|Барабаны
wind-instruments|Духовые
string-instruments|Смычковые
amplifiers|Усилители
effect-pedals|Педали эффектов
studio-equipment|Студийное оборудование
accessories|Аксессуары
sheet-music|Ноты`),
    ]),
    node('books', 'Книги', leaves('books-', `fiction|Художественная литература
nonfiction|Нон-фикшн
children|Детские книги
textbooks|Учебники
foreign-language|Книги на иностранных языках`)),
    node('comics', 'Комиксы', leaves('comics-', `manga|Манга
graphic-novels|Графические романы
single-issues|Выпуски комиксов`)),
    node('board-games', 'Настольные игры', leaves('board-game-', `strategy|Стратегии
party|Игры для компании
family|Семейные игры
card|Карточные игры
puzzles|Пазлы`)),
    node('collectibles', 'Коллекционирование', leaves('', `collectible-coins|Монеты
banknotes|Банкноты
stamps|Марки
trading-cards|Коллекционные карточки
collectible-figures|Фигурки
model-cars|Модели автомобилей
badges|Значки
medals|Медали
vinyl-records|Виниловые пластинки
retro-tech|Ретро-техника`)),
    node('handicrafts', 'Рукоделие', leaves('craft-', `yarn|Пряжа
fabric|Ткани
sewing-supplies|Швейная фурнитура
knitting-tools|Спицы и крючки
embroidery-kits|Наборы для вышивания
beads|Бисер`)),
    node('drawing', 'Рисование', leaves('art-', `paints|Краски
brushes|Кисти
canvases|Холсты
easels|Мольберты
sketchbooks|Скетчбуки
markers|Маркеры`)),
    node('modeling', 'Моделизм', leaves('modeling-', `scale-models|Сборные модели
model-kits|Наборы для моделизма
tools|Инструменты
paints|Краски`)),
    node('radio-control', 'Радиоуправляемые модели', leaves('rc-', `cars|Машины
airplanes|Самолёты
drones|Дроны
boats|Лодки
parts|Запчасти`)),
    node('antiques', 'Антиквариат', leaves('antique-', `furniture|Мебель
decor|Декор
books|Книги
dishes|Посуда
clocks|Часы`)),
  ]),
  node('beauty', 'Красота и уход', [
    node('fragrance', 'Парфюмерия', leaves('beauty-', `perfume|Парфюм
eau-de-toilette|Туалетная вода
sets|Подарочные наборы`)),
    node('makeup', 'Макияж', leaves('makeup-', `foundation|Тональные средства
powder|Пудры
mascara|Тушь
eyeshadow|Тени
lipstick|Помады
lip-gloss|Блески
pencils|Карандаши
brushes|Кисти
blush|Румяна`)),
    node('face-care', 'Уход за лицом', leaves('face-', `cleansers|Очищение
creams|Кремы
serums|Сыворотки
masks|Маски
sun-protection|Солнцезащита`)),
    node('body-care', 'Уход за телом', leaves('body-care-', `creams|Кремы
scrubs|Скрабы
shower-gels|Гели для душа
deodorants|Дезодоранты`)),
    node('hair-care', 'Уход за волосами', leaves('hair-care-', `shampoos|Шампуни
conditioners|Бальзамы
masks|Маски
styling|Укладка
hair-dyes|Краски для волос`)),
    node('manicure', 'Маникюр', leaves('manicure-', `polishes|Лаки
lamps|Лампы
tools|Инструменты
gel-polish|Гель-лаки`)),
    node('pedicure', 'Педикюр', leaves('pedicure-', `tools|Инструменты
care-products|Средства ухода`)),
    node('barber', 'Барбер', leaves('barber-', `clippers|Машинки для стрижки
trimmers|Триммеры
shaving|Бритьё
beard-care|Уход за бородой`)),
    node('beauty-devices', 'Косметические приборы', leaves('beauty-', `hair-dryers|Фены
stylers|Стайлеры
epilators|Эпиляторы
facial-devices|Приборы для лица
massage-devices|Массажёры`)),
    node('beauty-accessories', 'Аксессуары', leaves('beauty-accessory-', `cosmetic-bags|Косметички
mirrors|Зеркала
brushes|Расчёски
hair-accessories|Аксессуары для волос`)),
  ]),
  node('garden', 'Дача и сад', [
    node('garden-furniture', 'Садовая мебель', leaves('garden-furniture-', `tables|Столы
chairs|Стулья
benches|Скамейки
loungers|Шезлонги
sets|Комплекты`)),
    node('outdoor-cooking', 'Мангалы и гриль', leaves('outdoor-', `braziers|Мангалы
grills|Грили
barbecue|Барбекю
smokers|Коптильни
accessories|Аксессуары`)),
    node('greenhouses', 'Теплицы и парники', leaves('greenhouse-', `greenhouses|Теплицы
hotbeds|Парники
covering|Укрывной материал
accessories|Фурнитура`)),
    node('garden-power-tools', 'Садовая техника', leaves('garden-', `lawn-mowers|Газонокосилки
trimmers|Триммеры
walk-behind-tractors|Мотоблоки
cultivators|Культиваторы
chainsaws|Бензопилы
leaf-blowers|Воздуходувки
shredders|Измельчители`)),
    node('garden-tools', 'Садовый инструмент', leaves('garden-tool-', `shovels|Лопаты
rakes|Грабли
secateurs|Секаторы
wheelbarrows|Тачки
hoes|Тяпки`)),
    node('garden-watering', 'Полив', leaves('watering-', `hoses|Шланги
systems|Системы полива
sprinklers|Дождеватели
pumps|Насосы
watering-cans|Лейки`)),
    node('garden-leisure', 'Отдых на даче', leaves('garden-', `pools|Бассейны
swings|Качели
hammocks|Гамаки
gazebos|Беседки
parasols|Зонты`)),
    node('plants', 'Растения', leaves('plant-', `indoor|Комнатные растения
seedlings|Саженцы
seeds|Семена
flowers|Цветы
trees|Деревья
shrubs|Кустарники`)),
    node('garden-containers', 'Горшки и кашпо', leaves('garden-container-', `pots|Горшки
planters|Кашпо
flower-boxes|Ящики для цветов`)),
  ]),
