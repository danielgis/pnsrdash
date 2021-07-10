// const { doesNotReject } = require("assert");

require([
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "dojo/promise/all"
], function(
    QueryTask,
    Query,
    all
) {

    var urls = []
    urls.push('https://dportalgis.vivienda.gob.pe/dfdserver/rest/services/PNSR/padron_nominal/FeatureServer/0')
    urls.push('https://dportalgis.vivienda.gob.pe/dfdserver/rest/services/PNSR/limpieza_desinfeccion/MapServer/0')
    urls.push('https://dportalgis.vivienda.gob.pe/dfdserver/rest/services/PNSR/indicadores_cloracion/MapServer/0')
    urls.push('https://dportalgis.vivienda.gob.pe/dfdserver/rest/services/PNSR/visita_domiciliaria/MapServer/0')
    urls.push('https://dportalgis.vivienda.gob.pe/dfdserver/rest/services/PNSR/geo_componentes/MapServer/0')

    var df = Object()

    var surveys = [
        'Padron Nominal',
        'Limpieza y desinfeccion',
        'Indicadores de cloracion',
        'Visita domiciliaria',
        'Georref. de componentes'
    ]

    var _departamentos = {
        '08': 'CUSCO',
        '20': 'PIURA',
        '21': 'PUNO'
    }

    var timeRender = 1000 * 30



    // Nombre de campos originales
    var _cod_eval = 'cod_eval'
    var _calc_depa = 'calc_depa'

    // Nombre de campos de salidas
    var _n_encuestas_out = 'n_encuestas'
    var _cod_depa_out = 'departamento'
    var _survey = 'survey'

    var _where = `${_cod_eval} like 'OTS%' and ${_cod_eval} <> 'OTS-PRUEBA'`;

    var query = new Query();

    query.where = _where
    query.returnGeometry = false
    query.groupByFieldsForStatistics = [_cod_eval]

    query.outStatistics = [{
        onStatisticField: _cod_eval,
        outStatisticFieldName: _n_encuestas_out,
        statisticType: "count"
    }, {
        onStatisticField: _calc_depa,
        outStatisticFieldName: _cod_depa_out,
        statisticType: "min"
    }];

    var _chartPieSurveys;
    var _chartBarScoreOTS;
    var _chartStackBar;


    var status = 'initial';

    _renderAllDashboard = function() {
        let containerQueryTask = [];
        for (let i in urls) {
            let queryTask = new QueryTask({ url: urls[i] });
            let execute = queryTask.execute(query);
            containerQueryTask.push(execute);
        };
        promises = all(containerQueryTask);
        promises.then(handleQueryResults);
    }

    handleQueryResults = function(results) {
        let dataTotal = []
        results.forEach(function(elm, idx) {
            let data = elm['features'].map(i => ({...i['attributes'], survey: surveys[idx] }))
            dataTotal.push(...data)
        })

        df = new dfd.DataFrame(dataTotal);
        df[_cod_depa_out] = df[_cod_depa_out].apply((x) => { return _departamentos[x] });

        document.getElementById('n_encuestas').innerHTML = df[_n_encuestas_out].sum()
        document.getElementById('n_padron_nominal').innerHTML = df.query({ column: _survey, is: "==", to: surveys[0] })[_n_encuestas_out].sum()
        document.getElementById('n_limpieza_desinfeccion').innerHTML = df.query({ column: _survey, is: "==", to: surveys[1] })[_n_encuestas_out].sum()
        document.getElementById('n_indicadores_cloracion').innerHTML = df.query({ column: _survey, is: "==", to: surveys[2] })[_n_encuestas_out].sum()
        document.getElementById('n_visita_domiciliaria').innerHTML = df.query({ column: _survey, is: "==", to: surveys[3] })[_n_encuestas_out].sum()
        document.getElementById('n_geo_componentes').innerHTML = df.query({ column: _survey, is: "==", to: surveys[4] })[_n_encuestas_out].sum()

        // chart pie
        let df_gb = df.groupby([_cod_depa_out])
        let df_depa = df_gb.agg({ n_encuestas: "sum" });
        let x_pie = df_depa[_cod_depa_out].data
        let y_pie = df_depa[`${_n_encuestas_out}_sum`].data;


        // chart horizontalbar
        let df_gb_ots = df.groupby([_cod_eval])
        let df_survey_by_ots = df_gb_ots.agg({ n_encuestas: "sum" })

        df_survey_by_ots = df_survey_by_ots.data.sort(function(a, b) { return b[1] - a[1]; })

        let x_hbar = df_survey_by_ots.slice(0, 10).map((i) => i[0])
        let y_hbar = df_survey_by_ots.slice(0, 10).map((i) => i[1])

        document.getElementById('n_ots_encuesta').innerHTML = df_survey_by_ots.length

        // chart stacked bar
        let df_stacked_obj = df.groupby([_survey, _cod_depa_out])
        let df_stacked = df_stacked_obj.agg({ n_encuestas: "sum" })

        x_sbar = df_stacked[_cod_depa_out].unique().data
        y_sbar = [];

        for (let i in x_sbar) {
            let df_stacked_row = df_stacked.query({ column: _cod_depa_out, is: '==', to: x_sbar[i] })
            y_row = []
            for (let survey in surveys) {
                try {
                    let stack = df_stacked_row.query({ column: _survey, is: '==', to: surveys[survey] })
                    y_row.push(stack[`${_n_encuestas_out}_sum`].data[0])
                } catch (error) {
                    y_row.push(0)
                }

            }
            y_sbar.push(y_row);
        }
        y_sbar = y_sbar[0].map((_, colIndex) => y_sbar.map(row => row[colIndex]));


        if (status == 'update') {
            _drawChartPieSurveysByDepUpdate(x_pie, y_pie)
            _drawChartBarScoreOTSUpdate(x_hbar, y_hbar);
            _drawChartStackBarUpdate(x_sbar, y_sbar)
        } else {
            _drawChartPieSurveysByDep(x_pie, y_pie)
            _drawChartBarScoreOTS(x_hbar, y_hbar);
            _drawChartStackBar(x_sbar, y_sbar)
        }
        status = 'update';
    }

    // Funcion que permite generar el grafico de encuestas por departamento (pie)
    _drawChartPieSurveysByDep = function(x, y) {
        var ctx = document.getElementById('canvas_pie').getContext('2d');
        _chartPieSurveys = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: x,
                datasets: [{
                    label: 'Catidad de encuestas por departamento',
                    data: y,
                    backgroundColor: ['#07689f', '#68b0ab', 'rgb(255, 99, 132)', 'rgb(255, 205, 86)', '#fff48f'],
                    hoverOffset: 4
                }]
            },
            // plugins: [ChartDataLabels],
            options: {
                maintainAspectRatio: false,
                title: {
                    display: true,
                    text: 'Número de encuestas por región'
                }
            }
        });
    }

    // Funcion que permite actualizar el grafico de encuestas por departamento (pie)
    _drawChartPieSurveysByDepUpdate = function(x, y) {
        _chartPieSurveys.data.labels = x;
        _chartPieSurveys.data.datasets[0].data = y;
        _chartPieSurveys.update();
    }

    // Funcion que permite generar el grafico de score por OTS (horizontal ba)
    _drawChartBarScoreOTS = function(x, y) {
        var ctx = document.getElementById('score_ots').getContext('2d');;
        _chartBarScoreOTS = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: x,
                datasets: [{
                    label: '',
                    data: y,
                    borderWidth: 0.1,
                    borderColor: '#eeeeee',
                    backgroundColor: '#36a2eb'
                }]
            },
            options: {
                indexAxis: 'y',
                title: {
                    display: true,
                    text: 'Score de encuestas por OTS (10 primeros)'
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }]
                }
            }
        })
    }

    // Funcion que permite actualizar el grafico de score por OTS (horizontal bar)
    _drawChartBarScoreOTSUpdate = function(x, y) {
        _chartBarScoreOTS.data.labels = x;
        _chartBarScoreOTSn.data.datasets[0].data = y;
        _chartBarScoreOTS.update();
    }

    // Funcion que permite generar el grafico de encuestas por departamento (stackbar)
    _drawChartStackBar = function(x, y) {
        var ctx = document.getElementById("canvas_stacked").getContext('2d');
        _chartStackBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: x,
                datasets: [{
                    label: surveys[0],
                    backgroundColor: "#ffffcc",
                    data: y[0],
                }, {
                    label: surveys[1],
                    backgroundColor: "#a1dab4",
                    data: y[1],
                }, {
                    label: surveys[2],
                    backgroundColor: "#41b6c4",
                    data: y[2],
                }, {
                    label: surveys[3],
                    backgroundColor: "#2c7fb8",
                    data: y[3],
                }, {
                    label: surveys[4],
                    backgroundColor: "#253494",
                    data: y[4],
                }],
            },
            options: {
                title: {
                    display: true,
                    text: 'Cantidad de encuestas realizadas por tipo según región'
                },
                tooltips: {
                    displayColors: true,
                    callbacks: {
                        mode: 'x',
                    },
                },
                scales: {
                    xAxes: [{
                        stacked: true,
                        gridLines: {
                            display: false,
                        }
                    }],
                    yAxes: [{
                        stacked: true,
                        ticks: {
                            beginAtZero: true,
                        },
                        type: 'linear',
                    }]
                },
                responsive: true,
                maintainAspectRatio: false,
                legend: { position: 'bottom' },
            }
        });

    }

    // Funcion que permite actualizar el grafico de encuestas por departamento (stackbar)
    _drawChartStackBarUpdate = function(x, y) {
        _chartStackBar.data.labels = x;
        _chartStackBar.data.datasets[0].data = y;
        _chartStackBar.update();
    }

    // Funcion que permite descargar los datos utilizados para este dashboard en formato *.csv
    _downloadData = function() {
        df.to_csv().then(
            function(result) {
                var hiddenElement = document.createElement('a');
                hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(result);
                hiddenElement.download = 'pnsr_data.csv';
                hiddenElement.click();
            },
            function(error) {
                alert(error)
            })
    }

    // Conecta la funcion de descarga al boton downloadDataButton
    document.getElementById('downloadDataButton').addEventListener("click", _downloadData);

    _renderAllDashboard();

    window.setInterval(_renderAllDashboard, timeRender);

});