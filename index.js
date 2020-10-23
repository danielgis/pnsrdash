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

    var departamentos = {
        '8': 'CUSCO',
        '20': 'PIURA',
        '21': 'PUNO'
    }

    var query = new Query();
    // var queryTask = new QueryTask({ url: url_padron_nominal })

    query.where = "cod_eval like 'OTS%' and cod_eval <> 'OTS-PRUEBA'"
    query.returnGeometry = false
    query.groupByFieldsForStatistics = ['cod_eval']

    query.outStatistics = [{
        onStatisticField: "cod_eval",
        outStatisticFieldName: "n_encuestas",
        statisticType: "count"
    }, {
        onStatisticField: "calc_depa",
        outStatisticFieldName: "cod_depa",
        statisticType: "min"
    }];

    var df_surveys = new dfd.DataFrame(surveys, { columns: ['survey'] });

    _getDataByUrl = function() {
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
        // df.print()

        document.getElementById('n_encuestas').innerHTML = df['n_encuestas'].sum()
        document.getElementById('n_padron_nominal').innerHTML = df.query({ column: "survey", is: "==", to: surveys[0] })['n_encuestas'].sum()
        document.getElementById('n_limpieza_desinfeccion').innerHTML = df.query({ column: "survey", is: "==", to: surveys[1] })['n_encuestas'].sum()
        document.getElementById('n_indicadores_cloracion').innerHTML = df.query({ column: "survey", is: "==", to: surveys[2] })['n_encuestas'].sum()
        document.getElementById('n_visita_domiciliaria').innerHTML = df.query({ column: "survey", is: "==", to: surveys[3] })['n_encuestas'].sum()
        document.getElementById('n_geo_componentes').innerHTML = df.query({ column: "survey", is: "==", to: surveys[4] })['n_encuestas'].sum()

        // chart pie
        let df_gb = df.groupby(['cod_depa'])
        let df_depa = df_gb.agg({ "n_encuestas": "sum" })
        x_pie = df_depa['cod_depa'].data.map((i) => departamentos[String(i)])
        y_pie = df_depa['n_encuestas_sum'].data;
        _getChartPieSurveysByDep(x_pie, y_pie)

        // chart horizontalbar
        let df_gb_ots = df.groupby(['cod_eval'])
        let df_survey_by_ots = df_gb_ots.agg({ "n_encuestas": "sum" })

        df_survey_by_ots.sort_values({ by: "n_encuestas_sum", ascending: false, inplace: true })
            // df_survey_by_ots.print()
        x_hbar = df_survey_by_ots['cod_eval'].data.slice(0, 10)
        y_hbar = df_survey_by_ots['n_encuestas_sum'].data
        _drawChartBarScoreOTS(x_hbar, y_hbar.slice(0, 10));

        document.getElementById('n_ots_encuesta').innerHTML = df_gb_ots.data.length

        // chart stacked bar
        let df_stacked_obj = df.groupby(['survey', 'cod_depa'])
        let df_stacked = df_stacked_obj.agg({ "n_encuestas": "sum" })

        x = Object.values(departamentos)
        y = [];

        for (let i in departamentos) {
            let df_stacked_row = df_stacked.query({ column: 'cod_depa', is: '==', to: parseInt(i) })
                // df_stacked_row = df_stacked_row.reset_index()
            y_row = []
            for (let survey in surveys) {
                try {
                    let stack = df_stacked_row.query({ column: 'survey', is: '==', to: surveys[survey] })
                    y_row.push(stack['n_encuestas_sum'].data[0])
                } catch (error) {
                    y_row.push(0)
                }

            }
            y.push(y_row);

            // let merge_df = dfd.merge({ left: df_surveys, right: df_stacked_row, on: ['survey'], how: "right" })
            // merge_df.print()
        }
        y = y[0].map((_, colIndex) => y.map(row => row[colIndex]));
        _drawChartStackBar(x, y)
    }

    _getChartPieSurveysByDep = function(x, y) {
        var ctx = document.getElementById('canvas_pie').getContext('2d');
        var barChart = new Chart(ctx, {
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
                title: {
                    display: true,
                    text: 'Número de encuestas por región'
                }
            }
        });
    }

    _drawChartBarScoreOTS = function(x, y) {
        var ctx = document.getElementById('score_ots').getContext('2d');
        // ctx.canvas.height = 200;
        var myChart = new Chart(ctx, {
            type: 'horizontalBar',
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
                title: {
                    display: true,
                    text: 'Score de encuestas por OTS (10 primeros)'
                }
            }
        })
    }

    _drawChartStackBar = function(x, y) {
        var ctx = document.getElementById("canvas_stacked").getContext('2d');
        var myChart = new Chart(ctx, {
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
                    text: 'Número por tipo de encuesta a nivel de región'
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

    document.getElementById('downloadDataButton').addEventListener("click", _downloadData);

    _getDataByUrl();

    window.setInterval(_getDataByUrl, 1000 * 60 * 60);

});