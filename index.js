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

    var surveys = [
        'Padrón Nominal',
        'Limpieza y desinfección',
        'Indicadores de cloración',
        'Visita doiciliaria',
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
        outStatisticFieldName: "cod_eval_count",
        statisticType: "count"
    }, {
        onStatisticField: "calc_depa",
        outStatisticFieldName: "calc_depa",
        statisticType: "min"
    }];

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

            let df = new dfd.DataFrame(dataTotal);
            df.print()

            document.getElementById('n_encuestas').innerHTML = df['cod_eval_count'].sum()
            document.getElementById('n_padron_nominal').innerHTML = df.query({ column: "survey", is: "==", to: surveys[0] })['cod_eval_count'].sum()
            document.getElementById('n_limpieza_desinfeccion').innerHTML = df.query({ column: "survey", is: "==", to: surveys[1] })['cod_eval_count'].sum()
            document.getElementById('n_indicadores_cloracion').innerHTML = df.query({ column: "survey", is: "==", to: surveys[2] })['cod_eval_count'].sum()
            document.getElementById('n_visita_domiciliaria').innerHTML = df.query({ column: "survey", is: "==", to: surveys[3] })['cod_eval_count'].sum()
            document.getElementById('n_geo_componentes').innerHTML = df.query({ column: "survey", is: "==", to: surveys[4] })['cod_eval_count'].sum()

            df_gb = df.groupby(['calc_depa'])
            df_depa = df_gb.agg({ "cod_eval_count": "sum" })
            x = df_depa['calc_depa'].data.map((i) => departamentos[String(i)])
            y = df_depa['cod_eval_count_sum'].data

            var ctx = document.getElementById('canvas').getContext('2d');
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
                options: {}
            });
        },

        _getDataByUrl();


});