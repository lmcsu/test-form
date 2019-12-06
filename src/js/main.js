import $ from 'jquery'; // подключение jQuery
import 'jquery-form'; // подключение плагина для jQuery для простой отправки форм через ajax

// инициализация полей ввода текста
$('.field').each(function () {
    const $field = $(this); // основной блок
    const $input = $(this).find('input, textarea'); // поле внутри блока

    // флаг, находится ли поле в фокусе
    let focused = false;

    // функция проверки, есть ли содержимое в поле, в том числе каретка
    const hasContent = () => {
        return focused || $input.val() !== '';
    };

    // установка модификатора has-content
    const checkContent = () => {
        $field.toggleClass('field_has-content', hasContent());
    };

    // обработчик смены фокуса поля
    const focusChange = (state) => {
        focused = state;
        $field.toggleClass('field_focused', state);
        $field.toggleClass('field_error', false);
        checkContent();
    };

    // инициализация модификатора has-content
    checkContent();
    // многие браузеры могут автозаполнять поля сохранёнными данными, происходит это почти сразу после загрузки
    // страницы, поэтому перезапускаем проверку ещё раз чуть позже
    setTimeout(checkContent, 50);

    // установка событий на поле
    $input.on('focus', () => {
        focusChange(true);
    }).on('blur', () => {
        focusChange(false);
    }).on('input change', () => {
        // при изменении содержимого поля запускаем проверку на установку модификатора has-content
        checkContent();
    });
});

// убираем модификатор error при клике на чекбоксы
$('.checkbox').on('click', function () {
    $(this).toggleClass('checkbox_error', false);
});

// скрываем все error-tooltip при любом клике на странице
$(document).on('click', () => {
    $('.error-tooltip').toggleClass('error-tooltip_visible', false);
});

// инициализация формы
$('form').each(function () {
    const $form = $(this); // элемент формы
    const $successBlock = $('.success'); // блок после отправки формы
    const $formBlock = $form.closest('.form'); // основной блок
    const $button = $form.find('.button'); // кнопка отправки

    // функция проверки, является ли значение поля пустым
    const validationRuleEmptyCheck = ($input) => $input.val().trim() !== '';

    // правило для полей с пустыми значениями
    const validationRuleEmpty = {
        check: validationRuleEmptyCheck,
        message: 'Необходимо заполнить поле',
    };

    // конфигурация полей формы
    // name - имя input
    // blockType - тип основного блока поля
    // rules - правила валидации для поля
    const inputsConfig = [
        {
            name: 'name',
            blockType: 'field',
            rules: [
                validationRuleEmpty,
            ],
        },
        {
            name: 'email',
            blockType: 'field',
            rules: [
                validationRuleEmpty,
            ],
        },
        {
            name: 'message',
            blockType: 'field',
            rules: [
                validationRuleEmpty,
            ],
        },
        {
            name: 'g-recaptcha-response',
            blockType: 'recaptcha',
            rules: [
                {
                    check: validationRuleEmptyCheck,
                    message: 'Нажмите галочку для проверки',
                },
            ],
        },
        {
            name: 'policy',
            blockType: 'checkbox',
            rules: [
                {
                    check: ($input) => $input.is(':checked'), // проверка, отмечен ли чекбокс
                    message: 'Необходимо ваше согласие',
                },
            ],
        },
    ];

    // функция отображения ошибки для элементов управления формы
    const showError = ($block, blockType, message) => {
        $block.toggleClass(blockType + '_error', true); // устанавливаем модификатор error
        const $tooltip = $block.find('.error-tooltip'); // находим error-tooltip
        $tooltip.toggleClass('error-tooltip_visible', true); // устанавливаем ему модификатор error
        $tooltip.find('.error-tooltip__message').text(message); // устанавливаем в него текст ошибки
    };

    // функция валидации полей формы
    const validate = () => {
        // были ли ошибки валидации
        let hasErrors = false;

        // обработка конфигурации полей
        for (const inputConfig of inputsConfig) {
            const $input = $form.find(`[name="${inputConfig.name}"]`); // находим input
            const $block = $input.closest(`.${inputConfig.blockType}`); // находим блок поля
            let errorMessage = false; // сообщение об ошибке, которое требуется отобразить

            // обработка правил валидации для поля
            for (const rule of inputConfig.rules) {
                // если функция правила вернула false, значит произошла ошибка валидации
                if (!rule.check($input)) {
                    errorMessage = rule.message;
                    hasErrors = true;
                    // выходим из цикла проверки правил, т.к. уже произошла обишка
                    break;
                }
            }

            // если произошла ошибка валидации текущего поля, отображаем её
            if (errorMessage !== false) {
                showError($block, inputConfig.blockType, errorMessage);
            }
        }

        // возвращаем true, если валидация прошла успешно
        return !hasErrors;
    };

    // флаг, может ли форма быть отправленной
    let formActive = true;

    // функция переключения состояния загрузки формы, отключение возможности повторно отправить форму в тот момент,
    // когда она уже отправляется
    const toggleLoadingState = (enable) => {
        formActive = enable;
        // установка модификатора loading на кнопку
        $button.toggleClass('button_loading', !enable);
    };

    // инициализация ajax отправки формы из плагина jquery-form
    $form.ajaxForm({
        beforeSubmit: () => { // фнукция перед отправкой формы, возвращает false для отмены
            let result = true;

            // если в данный момент форма неактивна или не прошла валидация, то отменяем отправку
            if (!formActive || !validate()) {
                result = false;
            } else {
                // иначе переключаем состояние формы в загрузку
                toggleLoadingState(false);
            }

            return result;
        },
        error: () => { // функция при неудачной отправке формы на backend
            showError($button, 'button', 'Ошибка отправки формы, попробуйте позже');
            // возвращаем форму в прежнее состояние
            toggleLoadingState(true);
        },
        success: (data) => { // функция при успешной отправке формы на backend (ответ 200 и валидный json)
            // если backend вернул success=true, значит отправка данных и добавление в базу прошли успешно
            if (data.success) {
                const name = data.name; // имя пользователя, которое он ввёл в форму
                const message = `Спасибо, ${name}`; // сообщение для отображения пользователю
                $formBlock.toggleClass('form_hidden', true); // устанавливаем модификатора hidden на блок формы
                $successBlock.toggleClass('success_hidden', false); // убираем модификатор hidden с блока после отправки
                $successBlock.find('.success__message').text(message); // устанавливаем сообщение в блок после отправки
                // ждём отработки анимации блока формы, затем скрываем его полностью
                setTimeout(() => {
                    $formBlock.css('visibility', 'hidden');
                }, 1000);
            } else {
                // отправка формы не удалась
                // проверяем, есть ли ошибки валидации
                if (data.errors.length) {
                    // подготавливаем связи типов блоков с name полей
                    const blockTypes = {};
                    for (const inputConfig of inputsConfig) {
                        blockTypes[inputConfig.name] = inputConfig.blockType;
                    }

                    // обрабатываем ошибки валидации
                    for (const error of data.errors) {
                        const name = error.name; // name поля
                        const message = error.message; // сообщение об ошибке
                        const $input = $form.find(`[name="${name}"]`); // элемент поля
                        const $block = $input.closest(`.${blockTypes[name]}`); // основной блок поля
                        showError($block, blockTypes[name], message); // отображаем ошибку
                    }
                } else {
                    // ошибок валидации нет, отображаем общую ошибку под кнопкой
                    showError($button, 'button', 'Ошибка отправки формы, попробуйте позже');
                }
                // возвращаем форму в прежнее состояние
                toggleLoadingState(true);
            }
        },
        dataType: 'json', // результат получаем в json
    });
});
