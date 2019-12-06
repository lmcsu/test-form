// стандартные библиотеки Node.js
const fs = require('fs');
const path = require('path');

// подгрузка всех необходимых библиотек, требуемых для сборки
const gulp = require('gulp'); // основной экземпляр gulp
const connectPhp = require('gulp-connect-php'); // запуск dev-php-сервера
const browserSync = require('browser-sync').create(); // запуск dev-сервера
const gulpClean = require('gulp-clean'); // удаление файлов
const gulpPug = require('gulp-pug'); // сборщик pug
const gulpSass = require('gulp-sass'); // сборщик sass/scss
const sassTildeImporter = require('node-sass-tilde-importer'); // @import в sass из node_modules через знак ~
const gulpSourcemaps = require('gulp-sourcemaps'); // запись sourcemaps
const webpackStream = require('webpack-stream'); // сборщик js
const gulpSvgMin = require('gulp-svgmin'); // минификатор svg
const gulpSvgStore = require('gulp-svgstore'); // объединение svg файлов в один общий
const gulpRename = require('gulp-rename'); // переименовывание файлов
const gulpIf = require('gulp-if'); // проброс stream в gulp по условию
const gulpFileInclude = require('gulp-file-include'); // простой сборщик/шаблонизатор текстовых файлов
const gulpStylelint = require('gulp-stylelint'); // css линтер
const gulpEslint = require('gulp-eslint'); // js линтер
const gulpPugLinter = require('gulp-pug-linter'); // pug линтер
const uglifyJsWebpackPlugin = require('uglifyjs-webpack-plugin'); // минификация js
const gulpCleanCss = require('gulp-clean-css'); // минификация css
const gulpAutoprefixer = require('gulp-autoprefixer'); // генерация вендорных префиксов в css
const fancyLog = require('fancy-log'); // вывод логов/сообщений в терминал

// параметры режимов запуска
const MODE_DEVELOPMENT = 'development';
const MODE_PRODUCTION = 'production';
let currentMode = MODE_DEVELOPMENT;

// конфигурация из src/config.json
let config = {};

// считывание src/config.json
gulp.task('reload-config', (done) => {
    fs.readFile(path.resolve('src/config.json'), 'utf-8', (error, result) => {
        if (error) {
            // произошла ошибка чтения файла
            fancyLog.error(error);
        } else {
            try {
                // парсим json из файла
                config = JSON.parse(result);
            } catch (e) {
                // произошла ошибка парсинга json
                fancyLog.error(e);
            }
        }
        // вызываем callback для gulp, задача завершена
        done();
    });
});

// переключение режима в development
gulp.task('set-mode:development', (done) => {
    currentMode = MODE_DEVELOPMENT;
    // вызываем callback для gulp, задача завершена
    done();
});

// переключение режима в production
gulp.task('set-mode:production', (done) => {
    currentMode = MODE_PRODUCTION;
    // вызываем callback для gulp, задача завершена
    done();
});

// сборка js файлов
gulp.task('js', () => {
    // подключение минификации
    const minimizer = [];
    if (currentMode === MODE_PRODUCTION) {
        minimizer.push(new uglifyJsWebpackPlugin());
    }

    return gulp.src([
        'src/js/main.js',
    ])
        .pipe(webpackStream({
            mode: currentMode, // значение текущего режима совпадает с режимами webpack
            devtool: currentMode === MODE_PRODUCTION ? false : 'source-map', // включение записи sourcemaps
            module: {
                rules: [
                    // правила обработки js файлов
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    '@babel/preset-env',
                                ],
                            },
                        },
                    },
                ],
            },
            output: {
                filename: '[name].js',
            },
            optimization: {
                minimizer, // конфигурация минификации
                splitChunks: { // разделение библиотек из node_modules в отдельный файл
                    cacheGroups: {
                        vendors: {
                            name: 'vendor',
                            test: (module) => {
                                return module.context && (module.context.includes('node_modules'));
                            },
                            chunks: 'all',
                        },
                    },
                },
            },
        }))
        .pipe(gulp.dest('build/js'));
});

// сборка php файлов
gulp.task('php', () => {
    return gulp.src([
        'src/php/**/*.php',
    ])
        .pipe(gulpFileInclude({ // замена переменных конфигурации по шаблону
            prefix: '{{',
            suffix: '}}',
            context: config,
        }))
        .pipe(gulp.dest('build/'));
});

// сборка pug файлов
gulp.task('pug', () => {
    return gulp.src([
        'src/pug/*.pug',
        '!src/pug/_*.pug',
    ])
        .pipe(gulpPug({
            locals: config, // передача переменных конфигурации в global scope
        }))
        .pipe(gulp.dest('build'));
});

// сборка scss файлов
gulp.task('scss', () => {
    // инициализация экземпляра sass сборщика
    const gulpSassInstance = gulpSass({
        importer: [
            sassTildeImporter, // @import в sass из node_modules через знак ~
        ],
    })
        .on('error', gulpSass.logError); // обработка ошибок, вывод в стандартный лог

    return gulp.src([
        'src/scss/*.scss',
        '!src/scss/_*.scss',
    ])
        .pipe(gulpIf(currentMode === MODE_DEVELOPMENT, gulpSourcemaps.init())) // инициализация sourcemaps
        .pipe(gulpSassInstance)
        .pipe(gulpIf(currentMode === MODE_DEVELOPMENT, gulpSourcemaps.write('.'))) // запись sourcemaps
        .pipe(gulpIf(currentMode === MODE_PRODUCTION, gulpAutoprefixer())) // расстановка вендорных префиксов
        .pipe(gulpIf(currentMode === MODE_PRODUCTION, gulpCleanCss())) // минификация
        .pipe(gulp.dest('build/css'));
});

// сборка svg файлов
gulp.task('svg', () =>
    gulp.src('src/svg/*.svg')
        .pipe(gulpIf(currentMode === MODE_PRODUCTION, gulpSvgMin())) // минификация
        .pipe(gulpSvgStore()) // объединение в один файл
        .pipe(gulpRename('sprites.svg')) // переименовываем output файл
        .pipe(gulp.dest('build/img'))
);

// запуск dev-серверов
gulp.task('serve', () =>
    connectPhp.server({ // запуск php сервера
        base: 'build/',
        port: 4000,
    }, () => {
        browserSync.init({ // запуск browserSync
            files: [
                'build/**', // отслеживаем изменения в папке build
            ],
            proxy: '127.0.0.1:4000', // проксируем на php сервер
            open: false, // не открываем браузер при запуске
            notify: false, // отключаем уведомления в браузере
        });
    })
);

// обновление браузера в dev-сервере
gulp.task('browser-sync:reload', (done) => {
    browserSync.reload();
    done();
});

// включение отслеживания изменений файлов
gulp.task('watch', () => {
    gulp.watch('src/js/**', gulp.series('js'));
    gulp.watch('src/php/**', gulp.series('php'));
    gulp.watch('src/pug/**', gulp.series('pug'));
    gulp.watch('src/scss/**', gulp.series('scss'));
    gulp.watch('src/svg/**', gulp.series(
        'svg',
        'browser-sync:reload' // browserSync не реагирует на svg, делаем полную перезагрузку страницы
    ));
    gulp.watch('src/config.json', gulp.series(
        'reload-config',
        gulp.parallel( // после обновления конфигурации перезапускаем сборку php и pug
            'php',
            'pug'
        )
    ));
});

// очищение папки build
gulp.task('clean', () => {
    return gulp.src([
        'build/*',
    ], {
        read: false, // не считывать содержимое файлов
        allowEmpty: true, // отключение ошибки, если файлов не найдено
        dot: true, // включаем считывание файлов, начинающихся на символ точки
    })
        .pipe(gulpClean());
});

// линтинг scss файлов
gulp.task('lint:scss', () => {
    return gulp.src([
        'src/**/*.scss',
    ])
        .pipe(gulpStylelint({
            reporters: [ // включаем вывод сообщений в консоль
                {
                    formatter: 'string',
                    console: true,
                },
            ],
        }));
});

// линтинг js файлов
gulp.task('lint:js', () => {
    return gulp.src([
        'src/**/*.js',
        'gulpfile.js',
    ])
        .pipe(gulpEslint())
        .pipe(gulpEslint.format()); // вывод сообщений в консоль
});

// линтинг pug файлов
gulp.task('lint:pug', () => {
    return gulp.src([
        'src/**/*.pug',
    ])
        .pipe(gulpPugLinter({
            reporter: 'default', // включаем вывод сообщений в консоль
        }));
});

// запуск всех линтеров
gulp.task('lint', gulp.parallel(
    'lint:scss',
    'lint:js',
    'lint:pug'
));

// запуск сборки всех файлов
gulp.task('build', gulp.series(
    gulp.parallel(
        'clean',
        'reload-config'
    ),
    gulp.parallel(
        'js',
        'php',
        'pug',
        'scss',
        'svg'
    )
));

// развёртывание окружения разработки
gulp.task('dev', gulp.series(
    'set-mode:development',
    'build',
    gulp.parallel(
        'watch',
        'serve'
    )
));

// сборка итогового проекта
gulp.task('prod', gulp.parallel(
    'lint',
    gulp.series(
        'set-mode:production',
        'build'
    )
));

// запуск задачи по умолчанию
gulp.task('default', gulp.series('dev'));
