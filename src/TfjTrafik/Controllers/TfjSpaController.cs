using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

// For more information on enabling MVC for empty projects, visit http://go.microsoft.com/fwlink/?LinkID=397860

namespace Tfj.Controllers
{
    public class TfjSpaController : Controller
    {
        [Route("")]
        public IActionResult Index()
        {
            ViewBag.JsonInitialData =JsonConvert.SerializeObject(new
                {
                    //'http://localhost:61267/rr/trip.json'
                    tripsApiUrl = Url.Action("Call", "Reserobot", new { function = "trip" }),
                    //'http://localhost:61267/rr/location.name.json'
                    locationApiUrl = Url.Action("Call", "Reserobot", new { function = "location.name" })
                });
            return View();
        }
    }
}
