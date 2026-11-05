(() => {
  const s = window.SEASONS_ADMIN || {};
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const status = document.getElementById('status');
  if (!window.CMS) return;
  if (!local && (!/^[\w.-]+\/[\w.-]+$/.test(s.repo || '') || !/^https:\/\//.test(s.authServer || '') || !/^https:\/\//.test(s.siteUrl || ''))) {
    status.textContent = 'Панель подготовлена. Для включения входа нужно подключить репозиторий GitHub и сервис авторизации в admin/settings.js. Инструкция находится в README.md.';
    return;
  }
  const base = local ? new URL('../', location.href) : new URL(s.siteUrl.replace(/\/?$/, '/'));
  const backend = {name:'github',repo:s.repo || 'local/preview',branch:s.branch || 'main'};
  if (!local) Object.assign(backend,{base_url:s.authServer,auth_endpoint:'auth'});
  const config = {
    backend, load_config_file:false, locale:'ru',
    local_backend:local,
    media_folder:'assets/uploads', public_folder:base.pathname + 'assets/uploads',
    display_url:base.href, site_url:base.href,
    editor:{preview:false},
    collections:[{
      name:'guide',label:'Путеводитель 5 seasons',
      files:[{name:'events',label:'Мероприятия',file:'data/events.json',format:'json',
        fields:[{name:'events',label:'Мероприятия',widget:'list',summary:'{{fields.title}} — {{fields.date}}',collapsed:true,
          fields:[
            {name:'title',label:'Название',widget:'string'},
            {name:'published',label:'Показывать на сайте',widget:'boolean',default:false},
            {name:'image',label:'Фотография',widget:'image',allow_multiple:false},
            {name:'imageAlt',label:'Описание фотографии',widget:'string',required:false},
            {name:'description',label:'Описание мероприятия',widget:'text'},
            {name:'date',label:'Дата начала',widget:'datetime',date_format:'DD.MM.YYYY',time_format:false,format:'YYYY-MM-DD',picker_utc:true},
            {name:'endDate',label:'Дата окончания (если несколько дней)',widget:'datetime',date_format:'DD.MM.YYYY',time_format:false,format:'YYYY-MM-DD',picker_utc:true,required:false},
            {name:'time',label:'Время, например 19:00',widget:'string',required:false},
            {name:'location',label:'Место и адрес',widget:'string'},
            {name:'link',label:'Ссылка на билеты или подробности',widget:'string',required:false,pattern:['^https?://.+$','Ссылка должна начинаться с https:// или http://']},
            {name:'hidePast',label:'Автоматически скрыть после завершения',widget:'boolean',default:true}
          ]}]}]
    }]
  };
  document.getElementById('setup').hidden = true;
  CMS.init({config});
})();
