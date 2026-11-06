# R5S: вход в редактор

Этот каталог содержит код Cloudflare Worker, а не публичную страницу сайта.

## Подключение

1. В Cloudflare откройте Workers & Pages → r5s-auth → Edit code.
2. Замените стартовый код полным содержимым worker.mjs и нажмите Deploy.
3. В GitHub OAuth App R5S Admin проверьте callback:
   https://r5s-auth.dmitry724.workers.dev/callback
4. В Cloudflare → r5s-auth → Settings → Variables and Secrets добавьте два значения типа Secret:
   - GITHUB_CLIENT_ID: Client ID приложения R5S Admin.
   - GITHUB_CLIENT_SECRET: Client secret этого же OAuth App (Generate a new client secret, если ещё не создан).
5. Нажмите Deploy для применения секретов.
6. Откройте https://r5s-auth.dmitry724.workers.dev/health. Ответ о настроенном сервисе проверяет наличие двух значений, но не их правильность.
7. Убедитесь, что admin/settings.js содержит authServer: https://r5s-auth.dmitry724.workers.dev и siteUrl: https://r5s.ru/.
8. Откройте https://r5s.ru/admin/ и войдите через GitHub. Нужен аккаунт с правом записи в dmitry724gmail/r5s-site.
9. Добавьте тестовое мероприятие, проверьте его появление на сайте и удалите его через редактор.

Пароли, client secret и токены нельзя добавлять в этот репозиторий или пересылать в чат.
OAuth запрашивает public_repo: GitHub предоставляет этому разрешению доступ к публичным репозиториям пользователя, а не только к R5S. Сам Worker перед выдачей результата проверяет право записи в репозиторий R5S; это не сужает права выданного GitHub токена. Приватные репозитории не запрашиваются. При истечении access token выйдите из редактора и войдите снова; автоматическое продление здесь не реализовано.

## Проверки

node auth/test.mjs

Локальные проверки моделируют ответы GitHub и протокол окна Decap. Они не заменяют проверку реального входа и публикации после настройки Cloudflare.

В Worker фиксированы адрес сервиса, разрешённый адрес сайта и репозиторий. При смене адресов обновляйте их и callback приложения согласованно.

## Источники

- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-lib-auth/src/netlify-auth.js
