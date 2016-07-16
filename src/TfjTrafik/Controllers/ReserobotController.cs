using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System.Collections;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;

// For more information on enabling Web API for empty projects, visit http://go.microsoft.com/fwlink/?LinkID=397860

namespace Tfj.Controllers
{
    [Route("rr")]
    public class ReserobotController : Controller
    {
        private readonly IConfigurationRoot config;

        public ReserobotController(IConfigurationRoot config)
        {
            this.config = config;            
        }

        [Route("{function}.json")]
        [HttpPost]
        public async Task<JsonResult> Call(string function)
        {
            var rawBody = new byte[this.Request.ContentLength.Value];
            await this.Request.Body.ReadAsync(rawBody, 0, rawBody.Length);

            var query = JsonConvert.DeserializeObject<Dictionary<string, string>>(Encoding.UTF8.GetString(rawBody));
  
            var b = new UriBuilder($"https://api.resrobot.se/v2/{function}.json");
            var q = new Dictionary<string, string>();
            query.ToList().ForEach(x => q.Add(x.Key, x.Value));
            q["key"] = config["ReserobotApiKey"];
            b.Query = string.Join("&",q.Select(x => $"{x.Key}={x.Value}"));

            using (var c = new HttpClient())
            {
                var response = await c.GetAsync(b.ToString());
                response.EnsureSuccessStatusCode();
                var result = await response.Content.ReadAsByteArrayAsync();
                return Json(JsonConvert.DeserializeObject(Encoding.UTF8.GetString(result)));
            }
        }
    }
}
