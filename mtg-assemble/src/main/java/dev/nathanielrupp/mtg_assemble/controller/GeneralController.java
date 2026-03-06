package dev.nathanielrupp.mtg_assemble.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class GeneralController {

  @GetMapping("/hello-world")
  public String getMethodName() {
      return "Hello World!";
  }
  
}
