<?php

// если метод вызова не POST, выходим
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    die();
}

// подгружаем конфигурацию
$config = require_once __DIR__ . '/config.php';

// функция получения ip адреса клиента
function get_client_ip() {
    $ip = false;
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        $ip = $_SERVER['REMOTE_ADDR'];
    }
    return $ip;
}

// функция проверки reCaptcha
function verify_recaptcha($secret, $value) {
    $result = false;

    // подготавливаем POST-запрос
    $post_data = http_build_query(
        array(
            'secret' => $secret, // секретный ключ reCaptcha
            'response' => $value, // ключ, переданный клиентом
            'remoteip' => get_client_ip(), // ip-адрес клиента
        )
    );
    $opts = array('http' =>
        array(
            'method'  => 'POST',
            'header'  => 'Content-type: application/x-www-form-urlencoded',
            'content' => $post_data,
        )
    );
    $context  = stream_context_create($opts);

    try {
        // вызов POST-запроса
        $response = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);

        // парсим полученный json
        $data = json_decode($response, true);

        // если в ответе success=true, значит ключ клиента валидный
        if (isset($data['success']) && $data['success'] === true) {
            $result = true;
        }
    } catch (Exception $e) {
        // произошла ошибка при запросе
        $result = false;
    }

    return $result;
}

// правило валидации для пустого значения поля
$validation_rule_empty = [
    // функция проверки значения
    'check' => function ($value) {
        return $value !== '';
    },
    // сообщение об ошибке
    'message' => 'Необходимо заполнить поле',
];

// конфигурация названий и валидации полей
$inputs_config = [
    [ // имя
        'name' => 'name',
        'rules' => [
            $validation_rule_empty,
        ],
    ],
    [ // e-mail
        'name' => 'email',
        'rules' => [
            $validation_rule_empty,
            [
                // проверка валидности e-mail адреса
                'check' => function ($value) {
                    return filter_var($value, FILTER_VALIDATE_EMAIL);
                },
                // сообщение об ошибке
                'message' => 'Введён некорректный e-mail',
            ],
        ],
    ],
    [ // сообщение
        'name' => 'message',
        'rules' => [
            $validation_rule_empty,
        ],
    ],
    [ // ключ reCaptcha
        'name' => 'g-recaptcha-response',
        'rules' => [
            $validation_rule_empty,
            [
                // проверка ключа reCaptcha на валидность
                'check' => function ($value) use ($config) {
                    return verify_recaptcha($config['RECAPTCHA_SECRET_KEY'], $value);
                },
                // сообщение об ошибке
                'message' => 'Вы не прошли проверку на робота',
            ],
        ],
    ],
];

// успешно ли идёт обработка формы
$success = true;

// названия/значения полученных полей
$field_values = [];

// ошибки при валидации значений полей
$field_errors = [];

// получение значений полей из запроса и валидация, согласно конфигурации
foreach ($inputs_config as $input_config) {
    $name = $input_config['name']; // название поля
    $rules = isset($input_config['rules']) ? $input_config['rules'] : []; // правила валидации
    $value = isset($_POST[$name]) ? trim($_POST[$name]) : ''; // получение значения из запроса
    $field_values[$name] = $value; // помещаем значение в общий массив

    // применяем правила валидации
    foreach ($rules as $rule) {
        $check = $rule['check']; // функция проверки
        $message = $rule['message']; // сообщение об ошибке

        // если функция вернула false, значит валидация не прошла
        if (!$check($value)) {
            $success = false; // ошибка обработки формы

            // добавляем информацию об ошибке валидации
            $field_errors[] = [
                'name' => $name,
                'message' => $message,
            ];

            // выходим из цикла проверки правил для текущего значения
            break;
        }
    }
}

// если валидация прошла успешно, довавляем значения в базу данных
if ($success) {
    // конфигурация подключения к БД для PDO
    $dsn = $config['DB_DRIVER'] . ':'; // драйвер
    $dsn .= 'host=' . $config['DB_HOST'] . ';'; // хост
    $dsn .= 'dbname=' . $config['DB_NAME'] . ';'; // имя базы данных
    $dsn .= 'charset=' . $config['DB_CHARSET'] . ';'; // кодировка
    $dsn .= 'port=' . $config['DB_PORT'] . ';'; // порт

    // попытка подключиться и внести данные
    try {
        // создание экземпляра PDO
        $pdo = new PDO($dsn, $config['DB_USER'], $config['DB_PASSWORD'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, // вызывать исключения при возникновении ошибок
        ]);

        // подготовка и вызов запроса
        $stmt = $pdo->prepare('INSERT INTO leads (name, email, message) VALUES (?, ?, ?)');
        $stmt->execute([$field_values['name'], $field_values['email'], $field_values['message']]);
    } catch (Exception $e) {
        // произошла ошибка при добавлении в базу данны
        $success = false;
    }
}

$response = [
    'success' => $success, // успешно ли прошла обработка формы
    'errors' => $field_errors, // ошибки валидации
    'name' => $field_values['name'], // введённое имя пользователя, оно нужно для показа клиенту
];

// возвращаем клиенту ответ в json
echo json_encode($response);
